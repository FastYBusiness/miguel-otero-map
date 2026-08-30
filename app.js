/* ============================================================
   app.js — v6 · Navegación por relaciones reales
   Miguel Otero Cabaleiro
   Fuente única de datos: knowledge-base.json

   Principio:
   - Las referencias se localizan por ID real.
   - Un foco puede abrir varias ramas simultáneamente si la
     misma referencia está relacionada con varias áreas,
     aptitudes o sectores.
   - En navegación manual, cambiar de rama principal contrae
     las ramas anteriores y conserva abierta la nueva.
   ============================================================ */

(() => {
  'use strict';

  const DURACION = 220;
  const NIVEL_BASE = 1;

  let DATOS = null;
  let markmapInstancia = null;
  let focoActual = null;
  let ramaActual = null;
  let modoExpandido = false;

  const RAMAS = {
    identidad: 'Estabilizador Operativo de Valor Transversal',
    areas: 'Áreas de Gestión',
    aptitudes: 'Aptitudes Transversales',
    sectores: 'Sectores de Aplicación'
  };

  const NOMBRES_APTITUD = {
    operacion: 'Operación & Logística',
    comercial: 'Comercial & Negocio',
    liderazgo: 'Liderazgo & Personas',
    tecnologia: 'Tecnología & IA',
    administracion: 'Administración & Gestión'
  };

  const MENU = [
    { id: 'hr_ope', etiqueta: 'Operaciones', tipo: 'area' },
    { id: 'hr_com', etiqueta: 'Comercial', tipo: 'area' },
    { id: 'hr_ges', etiqueta: 'Gestión y organización', tipo: 'area' },
    { id: 'hr_per', etiqueta: 'Personas', tipo: 'area' },
    { id: 'hr_tec', etiqueta: 'Tecnología', tipo: 'area' },
    { id: 'seccion_aptitudes', etiqueta: 'Aptitudes', tipo: 'seccion' },
    { id: 'seccion_sectores', etiqueta: 'Sectores', tipo: 'seccion' },
    { id: 'seccion_nodos', etiqueta: 'Conocimiento', tipo: 'seccion' },
    { id: 'seccion_arbol', etiqueta: 'Árbol', tipo: 'arbol' }
  ];

  function normalizar(v) {
    return String(v ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function escapar(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function coincide(campo, q) {
    if (!campo || !q) return false;
    const texto = Array.isArray(campo) ? campo.join(' ') : campo;
    return normalizar(texto).includes(normalizar(q));
  }

  function porId(lista, id) {
    return (lista || []).find(x => x.id === id) || null;
  }

  function area(id) {
    return porId(DATOS?.areas_hr, id);
  }

  function sector(id) {
    return porId(DATOS?.sectores, id);
  }

  function aptitud(id) {
    for (const lista of Object.values(DATOS?.aptitudes || {})) {
      const x = porId(lista, id);
      if (x) return x;
    }
    return null;
  }

  function nombreArea(id) {
    return area(id)?.nombre || id;
  }

  function nombreSector(id) {
    return sector(id)?.nombre || id;
  }

  function nombreAptitud(id) {
    return aptitud(id)?.nombre || id;
  }

  function categoriaAptitud(id) {
    for (const [clave, lista] of Object.entries(DATOS?.aptitudes || {})) {
      if ((lista || []).some(x => x.id === id)) return clave;
    }
    return '';
  }

  function nodosArea(id) {
    return (DATOS?.nodos_conocimiento || [])
      .filter(n => (n.id_areas || []).includes(id));
  }

  function nodosAptitud(id) {
    return (DATOS?.nodos_conocimiento || [])
      .filter(n => (n.id_aptitudes || []).includes(id));
  }

  function nodosSector(id) {
    return (DATOS?.nodos_conocimiento || [])
      .filter(n => (n.id_sectores || []).includes(id));
  }

  function nodoPorId(id) {
    return porId(DATOS?.nodos_conocimiento, id);
  }

  /* ==========================================================
     BÚSQUEDA
     ========================================================== */

  function buscar(query) {
    const q = normalizar(query).trim();

    const r = {
      areas_hr: [],
      sectores: [],
      aptitudes: [],
      nodos: []
    };

    if (!q) return r;

    (DATOS.areas_hr || []).forEach(x => {
      if (coincide(x.nombre, q)) {
        r.areas_hr.push(x);
      }
    });

    (DATOS.sectores || []).forEach(x => {
      if (coincide(x.nombre, q)) {
        r.sectores.push(x);
      }
    });

    for (const lista of Object.values(DATOS.aptitudes || {})) {
      (lista || []).forEach(x => {
        if (coincide(x.nombre, q)) {
          r.aptitudes.push(x);
        }
      });
    }

    (DATOS.nodos_conocimiento || []).forEach(n => {
      const texto = [
        n.titulo,
        n.descripcion,
        n.tipo,
        n.periodo,
        n.entidades,
        n.palabras_clave,
        (n.id_areas || []).map(nombreArea),
        (n.id_aptitudes || []).map(nombreAptitud),
        (n.id_sectores || []).map(nombreSector)
      ];

      if (texto.some(x => coincide(x, q))) {
        r.nodos.push(n);
      }
    });

    return r;
  }

  /* ==========================================================
     MODELO DEL ÁRBOL
     ========================================================== */

  function nodo(
    content,
    children = [],
    payload = {},
    fold = 1
  ) {
    return {
      content: escapar(content),
      children,
      payload: {
        ...payload,
        fold
      }
    };
  }

  function nodoReferencia(n) {
    return nodo(
      n.titulo,
      [],
      {
        tipo: 'referencia',
        refId: n.id
      },
      1
    );
  }

  function construirAreas(foco) {

    return (DATOS.areas_hr || []).map(a => {

      const referencias =
        nodosArea(a.id);

      const hijos =
        referencias.map(
          nodoReferencia
        );

      const abierta =
        foco?.areas?.has(a.id) ||
        foco?.refsPorArea?.has(a.id);

      hijos.forEach(h => {

        if (
          foco?.refs?.has(
            h.payload.refId
          )
        ) {
          h.payload.fold = 0;
        }

      });

      return nodo(
        a.nombre,
        hijos,
        {
          tipo: 'area',
          refId: a.id
        },
        abierta ? 0 : 1
      );
    });
  }

  function construirAptitudes(foco) {

    return Object.entries(
      DATOS.aptitudes || {}
    ).map(([clave, lista]) => {

      const hijos =
        (lista || []).map(a => {

          return nodo(
            a.nombre,
            [],
            {
              tipo: 'aptitud',
              refId: a.id
            },
            foco?.aptitudes?.has(a.id)
              ? 0
              : 1
          );

        });

      const abierta =
        foco?.categoriasAptitud?.has(
          clave
        );

      return nodo(
        NOMBRES_APTITUD[clave] ||
          clave,
        hijos,
        {
          tipo: 'categoria_aptitud',
          refId: clave
        },
        abierta ? 0 : 1
      );
    });
  }

  function construirSectores(foco) {

    return (DATOS.sectores || [])
      .map(s => {

        return nodo(
          s.nombre,
          [],
          {
            tipo: 'sector',
            refId: s.id
          },
          foco?.sectores?.has(s.id)
            ? 0
            : 1
        );

      });
  }

  /* ==========================================================
     FOCO POR RELACIONES REALES
     ========================================================== */

  function crearFocoPorReferencia(refId) {

    const n =
      nodoPorId(refId);

    if (!n) return null;

    const f = {

      refs: new Set([refId]),

      areas:
        new Set(
          n.id_areas || []
        ),

      sectores:
        new Set(
          n.id_sectores || []
        ),

      aptitudes:
        new Set(
          n.id_aptitudes || []
        ),

      categoriasAptitud:
        new Set(),

      refsPorArea:
        new Set(
          n.id_areas || []
        )

    };

    (n.id_aptitudes || [])
      .forEach(id => {

        const cat =
          categoriaAptitud(id);

        if (cat) {
          f.categoriasAptitud.add(
            cat
          );
        }

      });

    return f;
  }

  function crearFocoPorTipo(
    tipo,
    id
  ) {

    if (tipo === 'referencia') {
      return crearFocoPorReferencia(id);
    }

    if (tipo === 'area') {

      const refs =
        nodosArea(id);

      return {

        refs:
          new Set(
            refs.map(n => n.id)
          ),

        areas:
          new Set([id]),

        refsPorArea:
          new Set([id]),

        sectores:
          new Set(
            refs.flatMap(
              n => n.id_sectores || []
            )
          ),

        aptitudes:
          new Set(
            refs.flatMap(
              n => n.id_aptitudes || []
            )
          ),

        categoriasAptitud:
          new Set(
            refs.flatMap(
              n =>
                (n.id_aptitudes || [])
                  .map(categoriaAptitud)
                  .filter(Boolean)
            )
          )
      };
    }

    if (tipo === 'aptitud') {

      const refs =
        nodosAptitud(id);

      return {

        refs:
          new Set(
            refs.map(n => n.id)
          ),

        areas:
          new Set(
            refs.flatMap(
              n => n.id_areas || []
            )
          ),

        sectores:
          new Set(
            refs.flatMap(
              n => n.id_sectores || []
            )
          ),

        aptitudes:
          new Set([id]),

        categoriasAptitud:
          new Set(
            [categoriaAptitud(id)]
              .filter(Boolean)
          ),

        refsPorArea:
          new Set()
      };
    }

    if (tipo === 'sector') {

      const refs =
        nodosSector(id);

      return {

        refs:
          new Set(
            refs.map(n => n.id)
          ),

        areas:
          new Set(
            refs.flatMap(
              n => n.id_areas || []
            )
          ),

        sectores:
          new Set([id]),

        aptitudes:
          new Set(
            refs.flatMap(
              n => n.id_aptitudes || []
            )
          ),

        categoriasAptitud:
          new Set(
            refs.flatMap(
              n =>
                (n.id_aptitudes || [])
                  .map(categoriaAptitud)
                  .filter(Boolean)
            )
          ),

        refsPorArea:
          new Set()
      };
    }

    return null;
  }

  function construirArbol(
    foco = null
  ) {

    const perfil =
      DATOS?.perfil || {};

    const identidad =
      nodo(
        perfil.identidad_profesional ||
          'Estabilizador operativo transversal',
        [
          nodo(
            perfil.mision || '',
            [],
            {
              tipo: 'mision'
            },
            1
          )
        ],
        {
          tipo: 'identidad'
        },
        1
      );

    const areas =
      nodo(
        RAMAS.areas,
        construirAreas(foco),
        {
          tipo: 'areas'
        },
        foco?.areas?.size
          ? 0
          : 1
      );

    const aptitudes =
      nodo(
        RAMAS.aptitudes,
        construirAptitudes(foco),
        {
          tipo: 'aptitudes'
        },
        foco?.aptitudes?.size
          ? 0
          : 1
      );

    const sectores =
      nodo(
        RAMAS.sectores,
        construirSectores(foco),
        {
          tipo: 'sectores'
        },
        foco?.sectores?.size
          ? 0
          : 1
      );

    return nodo(
      perfil.nombre ||
        'Miguel Otero Cabaleiro',
      [
        identidad,
        areas,
        aptitudes,
        sectores
      ],
      {
        tipo: 'raiz'
      },
      0
    );
  }

  /* ==========================================================
     RENDER
     ========================================================== */

  function renderArbol(
    foco = null,
    nivel = NIVEL_BASE
  ) {

    if (
      !window.markmap?.Markmap ||
      !DATOS
    ) {
      return;
    }

    const svg =
      document.getElementById(
        'mapa'
      );

    if (!svg) return;

    svg.innerHTML = '';

    const arbol =
      construirArbol(foco);

    markmapInstancia =
      window.markmap.Markmap.create(
        '#mapa',
        {
          autoFit: true,
          initialExpandLevel: nivel,
          duration: DURACION,
          maxWidth: 250,
          spacingHorizontal: 52,
          spacingVertical: 5,
          zoom: true,
          pan: true
        },
        arbol
      );

    focoActual = foco;

    setTimeout(
      () => {

        instalarInteraccionArbol();

        resaltarReferencias(
          foco
        );

      },
      DURACION + 60
    );
  }

  function resaltarReferencias(
    foco
  ) {

    document
      .querySelectorAll(
        '#mapa .markmap-node'
      )
      .forEach(el => {

        el.classList.remove(
          'nodo-activo'
        );

      });

    if (
      !foco?.refs?.size
    ) {
      return;
    }

    document
      .querySelectorAll(
        '#mapa .markmap-node'
      )
      .forEach(el => {

        const texto =
          normalizar(
            el.querySelector(
              'text'
            )?.textContent || ''
          );

        for (
          const id of foco.refs
        ) {

          const n =
            nodoPorId(id);

          if (
            n &&
            normalizar(n.titulo) ===
              texto
          ) {

            el.classList.add(
              'nodo-activo'
            );

            break;
          }
        }
      });
  }

  /* ==========================================================
     INTERACCIÓN DEL ÁRBOL
     ========================================================== */

  function instalarInteraccionArbol() {

    const svg =
      document.getElementById(
        'mapa'
      );

    if (!svg) return;

    svg
      .querySelectorAll(
        '.markmap-node'
      )
      .forEach(el => {

        if (
          el.dataset.v6 === '1'
        ) {
          return;
        }

        el.dataset.v6 = '1';

        el.addEventListener(
          'click',
          evento => {

            const texto =
              (
                el.querySelector(
                  'text'
                )?.textContent || ''
              ).trim();

            if (!texto) {
              return;
            }

            const rama =
              determinarRamaPrincipal(
                texto
              );

            if (!rama) {
              return;
            }

            /*
             * MISMA RAMA:
             * Markmap conserva su comportamiento
             * natural de expandir/contraer.
             *
             * OTRA RAMA:
             * reconstruimos el árbol.
             */
            if (
              ramaActual &&
              ramaActual !== rama
            ) {

              evento.stopPropagation();

              ramaActual =
                rama;

              const foco =
                focoDesdeNodo(
                  texto,
                  rama
                );

              setTimeout(
                () => {

                  renderArbol(
                    foco,
                    1
                  );

                },
                10
              );

              return;
            }

            ramaActual =
              rama;

            setTimeout(
              () =>
                resaltarReferencias(
                  focoActual
                ),
              DURACION + 20
            );
          },
          true
        );
      });
  }

  function determinarRamaPrincipal(
    texto
  ) {

    const q =
      normalizar(texto);

    if (
      q === normalizar(
        RAMAS.identidad
      )
    ) {
      return 'identidad';
    }

    if (
      q === normalizar(
        RAMAS.areas
      )
    ) {
      return 'areas';
    }

    if (
      q === normalizar(
        RAMAS.aptitudes
      )
    ) {
      return 'aptitudes';
    }

    if (
      q === normalizar(
        RAMAS.sectores
      )
    ) {
      return 'sectores';
    }

    if (
      ramaContieneTexto(
        'areas',
        q
      )
    ) {
      return 'areas';
    }

    if (
      ramaContieneTexto(
        'aptitudes',
        q
      )
    ) {
      return 'aptitudes';
    }

    if (
      ramaContieneTexto(
        'sectores',
        q
      )
    ) {
      return 'sectores';
    }

    return null;
  }

  function ramaContieneTexto(
    rama,
    q
  ) {

    if (rama === 'areas') {

      return (
        DATOS.areas_hr || []
      ).some(a =>

        normalizar(a.nombre) ===
          q ||

        nodosArea(a.id)
          .some(n =>
            normalizar(
              n.titulo
            ) === q
          )
      );
    }

    if (
      rama ===
      'aptitudes'
    ) {

      return Object
        .values(
          DATOS.aptitudes || {}
        )
        .flat()
        .some(a =>
          normalizar(
            a.nombre
          ) === q
        );
    }

    if (
      rama ===
      'sectores'
    ) {

      return (
        DATOS.sectores || []
      ).some(s =>
        normalizar(
          s.nombre
        ) === q
      );
    }

    return false;
  }

  function focoDesdeNodo(
    texto,
    rama
  ) {

    const q =
      normalizar(texto);

    if (rama === 'areas') {

      const a =
        (
          DATOS.areas_hr || []
        ).find(
          x =>
            normalizar(
              x.nombre
            ) === q
        );

      if (a) {
        return crearFocoPorTipo(
          'area',
          a.id
        );
      }

      const n =
        (
          DATOS.nodos_conocimiento ||
          []
        ).find(
          x =>
            normalizar(
              x.titulo
            ) === q
        );

      if (n) {
        return crearFocoPorReferencia(
          n.id
        );
      }
    }

    if (
      rama ===
      'aptitudes'
    ) {

      const a =
        Object
          .values(
            DATOS.aptitudes || {}
          )
          .flat()
          .find(
            x =>
              normalizar(
                x.nombre
              ) === q
          );

      if (a) {
        return crearFocoPorTipo(
          'aptitud',
          a.id
        );
      }
    }

    if (
      rama ===
      'sectores'
    ) {

      const s =
        (
          DATOS.sectores || []
        ).find(
          x =>
            normalizar(
              x.nombre
            ) === q
        );

      if (s) {
        return crearFocoPorTipo(
          'sector',
          s.id
        );
      }
    }

    return null;
  }

  /* ==========================================================
     VISTAS
     ========================================================== */

  function activarContenido() {

    const lateral =
      document.querySelector(
        '.lateral'
      );

    const zona =
      document.querySelector(
        '.zona-arbol'
      );

    if (!lateral || !zona) {
      return;
    }

    lateral.style.display =
      'flex';

    lateral.style.width =
      '100%';

    lateral.style.minWidth =
      '0';

    lateral.style.maxWidth =
      'none';

    zona.style.display =
      'none';

    document.body.classList.add(
      'vista-contenido'
    );

    document.body.classList.remove(
      'vista-arbol'
    );
  }

  function activarArbol() {

    const lateral =
      document.querySelector(
        '.lateral'
      );

    const zona =
      document.querySelector(
        '.zona-arbol'
      );

    if (!lateral || !zona) {
      return;
    }

    lateral.style.display =
      'none';

    zona.style.display =
      'flex';

    document.body.classList.add(
      'vista-arbol'
    );

    document.body.classList.remove(
      'vista-contenido'
    );
  }

  function activarMenu(id) {

    document
      .querySelectorAll(
        '.menu-btn'
      )
      .forEach(btn => {

        btn.classList.toggle(
          'activo',
          btn.dataset.id === id
        );

      });
  }

  function mostrarHTML(html) {

    const contexto =
      document.getElementById(
        'contexto'
      );

    if (contexto) {

      contexto.innerHTML =
        html;

      contexto.scrollTop =
        0;
    }
  }

  function mensaje(texto) {

    mostrarHTML(`
      <div class="contexto-vacio">
        ${escapar(texto)}
      </div>
    `);
  }

  /* ==========================================================
     TARJETAS
     ========================================================== */

  function botonMapa(
    tipo,
    id
  ) {

    return `
      <button
        type="button"
        class="btn-herramienta btn-ver-arbol"
        data-tipo-ref="${escapar(tipo)}"
        data-ref-id="${escapar(id)}">
        Ver en árbol
      </button>
    `;
  }

  function tarjetaNodo(n) {

    const tipo =
      normalizar(n.tipo);

    let borde =
      '#FF9900';

    if (
      tipo === 'experiencia'
    ) {
      borde = '#007185';
    }

    if (
      tipo === 'formacion'
    ) {
      borde = '#2e7d32';
    }

    if (
      tipo === 'capacitacion'
    ) {
      borde = '#d32f2f';
    }

    if (
      tipo === 'evidencia'
    ) {
      borde = '#6a1b9a';
    }

    let html = `
      <article
        class="item"
        style="border-left:4px solid ${borde};">

        <div class="item-cabecera">
          <b>
            ${escapar(n.titulo)}
          </b>

          <span
            class="item-badge"
            style="background:${borde};">

            ${escapar(
              String(
                n.tipo ||
                'nodo'
              ).toUpperCase()
            )}

          </span>
        </div>
    `;

    if (n.periodo) {

      html += `
        <div class="item-periodo">
          ${escapar(n.periodo)}
        </div>
      `;
    }

    if (n.descripcion) {

      html += `
        <div class="item-descripcion">
          ${escapar(
            n.descripcion
          )}
        </div>
      `;
    }

    const campos = [
      [
        'Entidades / Empresas',
        n.entidades
      ],
      [
        'Áreas relacionadas',
        (n.id_areas || [])
          .map(nombreArea)
      ],
      [
        'Sectores relacionados',
        (n.id_sectores || [])
          .map(nombreSector)
      ],
      [
        'Aptitudes demostradas',
        (n.id_aptitudes || [])
          .map(nombreAptitud)
      ],
      [
        'Palabras clave',
        n.palabras_clave
      ]
    ];

    campos.forEach(
      ([label, value]) => {

        if (
          value &&
          (
            !Array.isArray(value) ||
            value.length
          )
        ) {

          html += `
            <div class="ctx-label">
              ${escapar(label)}
            </div>

            <div>
              ${escapar(
                Array.isArray(value)
                  ? value.join(', ')
                  : value
              )}
            </div>
          `;
        }
      }
    );

    html += `
        <div class="item-accion">
          ${botonMapa(
            'referencia',
            n.id
          )}
        </div>

      </article>
    `;

    return html;
  }

  function tarjetaAptitud(a) {

    const refs =
      nodosAptitud(a.id);

    return `
      <article class="item">

        <div class="item-cabecera">
          <b>
            ${escapar(a.nombre)}
          </b>

          <span class="item-categoria">
            ${escapar(
              categoriaAptitud(
                a.id
              )
            )}
          </span>
        </div>

        <div class="item-descripcion">
          Capacidad profesional
          vinculada a
          ${refs.length}
          referencia(s)
          documentada(s) en la base.
        </div>

        <div class="ctx-label">
          Referencias sólidas ·
          ${refs.length}
        </div>

        ${
          refs.map(
            n => `
              <div
                class="referencia-linea">

                <b>
                  ${escapar(
                    n.titulo
                  )}
                </b>

                ${
                  n.periodo
                    ? `
                      <div class="item-periodo">
                        ${escapar(
                          n.periodo
                        )}
                      </div>
                    `
                    : ''
                }

              </div>
            `
          ).join('')
        }

        <div class="item-accion">
          ${botonMapa(
            'aptitud',
            a.id
          )}
        </div>

      </article>
    `;
  }

  function tarjetaSector(s) {

    const refs =
      nodosSector(s.id);

    return `
      <article class="item">

        <b>
          ${escapar(s.nombre)}
        </b>

        <div class="item-descripcion">
          ${refs.length}
          referencia(s)
          profesional(es)
          asociada(s).
        </div>

        <div class="ctx-label">
          Referencias
        </div>

        ${
          refs.map(
            n => `
              <div
                class="referencia-linea">

                ${escapar(
                  n.titulo
                )}

              </div>
            `
          ).join('')
        }

        <div class="item-accion">
          ${botonMapa(
            'sector',
            s.id
          )}
        </div>

      </article>
    `;
  }

  /* ==========================================================
     CONTENIDOS
     ========================================================== */

  function mostrarArea(a) {

    activarContenido();
    activarMenu(a.id);

    const refs =
      nodosArea(a.id);

    let html = `
      <div class="ctx-titulo">
        ${escapar(a.nombre)}
      </div>

      <div class="ctx-desc">
        Experiencias, conocimientos
        y evidencias vinculadas a
        esta área profesional.
      </div>

      <div class="ctx-label">
        Referencias relacionadas ·
        ${refs.length}
      </div>
    `;

    refs.forEach(
      n => {
        html += tarjetaNodo(n);
      }
    );

    mostrarHTML(html);
  }

  function mostrarAptitudes() {

    activarContenido();

    activarMenu(
      'seccion_aptitudes'
    );

    let html = `
      <div class="ctx-titulo">
        Aptitudes
      </div>

      <div class="ctx-desc">
        Capacidades profesionales
        consultables y vinculadas
        a referencias concretas.
      </div>
    `;

    for (
      const [cat, lista]
      of Object.entries(
        DATOS.aptitudes || {}
      )
    ) {

      html += `
        <div class="ctx-label">
          ${escapar(cat)}
        </div>
      `;

      (lista || []).forEach(
        a => {
          html += tarjetaAptitud(a);
        }
      );
    }

    mostrarHTML(html);
  }

  function mostrarSectores() {

    activarContenido();

    activarMenu(
      'seccion_sectores'
    );

    let html = `
      <div class="ctx-titulo">
        Sectores
      </div>

      <div class="ctx-desc">
        Sectores en los que existe
        experiencia, aplicación o
        conocimiento relacionado.
      </div>
    `;

    (
      DATOS.sectores || []
    ).forEach(
      s => {
        html += tarjetaSector(s);
      }
    );

    mostrarHTML(html);
  }

  function mostrarConocimiento() {

    activarContenido();

    activarMenu(
      'seccion_nodos'
    );

    const refs =
      DATOS.nodos_conocimiento ||
      [];

    let html = `
      <div class="ctx-titulo">
        Conocimiento
      </div>

      <div class="ctx-desc">
        Inventario consultable de
        experiencias, formación,
        capacitación y evidencias.
      </div>

      <div class="ctx-label">
        Referencias ·
        ${refs.length}
      </div>
    `;

    refs.forEach(
      n => {
        html += tarjetaNodo(n);
      }
    );

    mostrarHTML(html);
  }

  function resultadosBusqueda(
    r,
    q
  ) {

    activarContenido();

    const total =
      r.areas_hr.length +
      r.sectores.length +
      r.aptitudes.length +
      r.nodos.length;

    if (!total) {

      mensaje(
        `Sin resultados para «${q}».`
      );

      return;
    }

    let html = `
      <div class="ctx-titulo">
        Resultados
      </div>

      <div class="ctx-desc">
        ${total}
        referencia(s)
        encontrada(s) para
        «${escapar(q)}».
      </div>
    `;

    r.areas_hr.forEach(
      a => {

        html += `
          <article class="item">

            <b>
              ${escapar(
                a.nombre
              )}
            </b>

            <div class="item-accion">
              ${botonMapa(
                'area',
                a.id
              )}
            </div>

          </article>
        `;
      }
    );

    r.aptitudes.forEach(
      a => {
        html +=
          tarjetaAptitud(a);
      }
    );

    r.sectores.forEach(
      s => {
        html +=
          tarjetaSector(s);
      }
    );

    r.nodos.forEach(
      n => {
        html +=
          tarjetaNodo(n);
      }
    );

    mostrarHTML(html);
  }

  /* ==========================================================
     MENÚ
     ========================================================== */

  function renderMenu() {

    const menu =
      document.getElementById(
        'menu'
      );

    if (!menu) return;

    menu.innerHTML =
      MENU.map(
        item => `
          <button
            type="button"
            class="menu-btn"
            data-id="${escapar(
              item.id
            )}"
            data-tipo="${escapar(
              item.tipo
            )}">

            ${escapar(
              item.etiqueta
            )}

          </button>
        `
      ).join('');

    menu
      .querySelectorAll(
        '.menu-btn'
      )
      .forEach(btn => {

        btn.addEventListener(
          'click',
          () => {

            navegarMenu(
              btn.dataset.id,
              btn.dataset.tipo
            );

          }
        );
      });
  }

  function navegarMenu(
    id,
    tipo
  ) {

    if (
      tipo ===
      'arbol'
    ) {

      mostrarVistaArbol();

      return;
    }

    if (
      tipo ===
      'area'
    ) {

      const a =
        area(id);

      if (a) {
        mostrarArea(a);
      }

      return;
    }

    if (
      id ===
      'seccion_aptitudes'
    ) {

      mostrarAptitudes();

      return;
    }

    if (
      id ===
      'seccion_sectores'
    ) {

      mostrarSectores();

      return;
    }

    if (
      id ===
      'seccion_nodos'
    ) {

      mostrarConocimiento();
    }
  }

  /* ==========================================================
     ÁRBOL DESDE MENÚ
     ========================================================== */

  function mostrarVistaArbol(
    foco = null
  ) {

    activarArbol();

    ramaActual = null;
    focoActual = foco;
    modoExpandido = false;

    renderArbol(
      foco,
      NIVEL_BASE
    );
  }

  function volverMenu() {

    activarContenido();

    activarMenu('');

    focoActual = null;
    ramaActual = null;

    mensaje(
      'Selecciona una categoría o utiliza el buscador.'
    );
  }

  function restablecerVista() {

    const buscador =
      document.getElementById(
        'buscador'
      );

    if (buscador) {
      buscador.value = '';
    }

    mostrarVistaArbol();
  }

  /* ==========================================================
     BOTONES DEL ÁRBOL
     ========================================================== */

  function conectarBotonesArbol() {

    document
      .getElementById(
        'btn-volver'
      )
      ?.addEventListener(
        'click',
        volverMenu
      );

    document
      .getElementById(
        'btn-expandir'
      )
      ?.addEventListener(
        'click',
        () => {

          activarArbol();

          modoExpandido =
            true;

          renderArbol(
            null,
            99
          );
        }
      );

    document
      .getElementById(
        'btn-contraer'
      )
      ?.addEventListener(
        'click',
        () => {

          activarArbol();

          modoExpandido =
            false;

          ramaActual =
            null;

          focoActual =
            null;

          renderArbol(
            null,
            NIVEL_BASE
          );
        }
      );

    document
      .getElementById(
        'btn-limpiar'
      )
      ?.addEventListener(
        'click',
        restablecerVista
      );
  }

  /* ==========================================================
     "VER EN ÁRBOL"
     ========================================================== */

  function conectarReferencias() {

    document.addEventListener(
      'click',
      evento => {

        const btn =
          evento.target.closest(
            '.btn-ver-arbol'
          );

        if (!btn) return;

        const tipo =
          btn.dataset.tipoRef;

        const id =
          btn.dataset.refId;

        const foco =
          crearFocoPorTipo(
            tipo,
            id
          );

        if (!foco) return;

        activarMenu(
          'seccion_arbol'
        );

        activarArbol();

        ramaActual =
          null;

        renderArbol(
          foco,
          1
        );
      }
    );
  }

  /* ==========================================================
     BUSCADOR
     ========================================================== */

  function conectarBuscador() {

    const input =
      document.getElementById(
        'buscador'
      );

    if (!input) return;

    input.addEventListener(
      'input',
      evento => {

        const q =
          evento.target.value.trim();

        if (!q) {

          volverMenu();

          return;
        }

        resultadosBusqueda(
          buscar(q),
          q
        );
      }
    );
  }

  /* ==========================================================
     CABECERA
     ========================================================== */

  function actualizarCabecera() {

    const perfil =
      DATOS?.perfil || {};

    const magnitudes =
      DATOS?.magnitudes || {};

    const nombre =
      document.querySelector(
        '.cabecera-nombre'
      );

    const titulo =
      document.querySelector(
        '.cabecera-titulo'
      );

    if (nombre) {

      nombre.textContent =
        perfil.nombre ||
        'Miguel Otero Cabaleiro';
    }

    if (titulo) {

      titulo.textContent =
        'Estabilizador operativo transversal';
    }

    const exp =
      document.getElementById(
        'm-exp'
      );

    const hab =
      document.getElementById(
        'm-sec'
      );

    if (exp) {

      exp.textContent =
        `${Number(
          magnitudes.anos_experiencia ||
          35
        )}+`;
    }

    if (hab) {

      /*
       * La base actual contiene
       * magnitudes. No inventamos
       * el valor: usamos habilidades
       * si existe y 20 como fallback.
       */
      hab.textContent =
        `${Number(
          magnitudes.habilidades ||
          20
        )}+`;
    }

    const tercera =
      document.querySelector(
        '.cabecera-magnitudes .magnitud:nth-child(3)'
      );

    if (tercera) {
      tercera.remove();
    }

    const subtitulo =
      document.querySelector(
        '.cabecera-subtitulo'
      );

    if (subtitulo) {
      subtitulo.style.display =
        'none';
    }
  }

  /* ==========================================================
     INICIO
     ========================================================== */

  async function iniciar() {

    try {

      const respuesta =
        await fetch(
          './knowledge-base.json',
          {
            cache: 'no-store'
          }
        );

      if (!respuesta.ok) {

        throw new Error(
          `HTTP ${respuesta.status}`
        );
      }

      DATOS =
        await respuesta.json();

      actualizarCabecera();

      renderMenu();

      conectarBuscador();

      conectarBotonesArbol();

      conectarReferencias();

      activarContenido();

      mensaje(
        'Selecciona una categoría o utiliza el buscador.'
      );

      console.log(
        '✓ MiguelMapa v6 cargado.'
      );

    } catch (error) {

      console.error(
        'Error cargando knowledge-base.json:',
        error
      );

      mostrarHTML(`
        <div class="contexto-vacio">
          No se pudo cargar
          <b>knowledge-base.json</b>.
        </div>
      `);
    }
  }

  /* ==========================================================
     API
     ========================================================== */

  window.MiguelMapa = {

    buscar,

    construirArbol,

    renderArbol,

    mostrarVistaArbol,

    restablecerVista,

    volverMenu

  };

  if (
    typeof module !==
    'undefined' &&
    module.exports
  ) {

    module.exports = {

      normalizar,

      coincide,

      buscar,

      construirArbol

    };
  }

  document.addEventListener(
    'DOMContentLoaded',
    iniciar
  );

})();
