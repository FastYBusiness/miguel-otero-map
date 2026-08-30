(() => {
  'use strict';

  /*
   * MIGUEL OTERO CABALEIRO
   * MAPA PROFESIONAL — APP v7
   *
   * Navegación basada en las relaciones reales
   * existentes en knowledge-base.json:
   *
   *   id_areas
   *   id_aptitudes
   *   id_sectores
   *
   * No se utilizan coincidencias de texto para
   * determinar las relaciones profesionales.
   */

  const DURACION = 220;
  const NIVEL_INICIAL = 1;

  let DATOS = null;
  let mapa = null;

  let estado = {
    modo: 'contenido',
    rama: null,
    foco: null
  };

  const RAMAS = {
    identidad: 'Estabilizador Operativo de Valor Transversal',
    areas: 'Áreas de Gestión',
    aptitudes: 'Aptitudes Transversales',
    sectores: 'Sectores de Aplicación'
  };

  const CATEGORIAS_APTITUD = {
    operacion: 'Operación & Logística',
    comercial: 'Comercial & Negocio',
    liderazgo: 'Liderazgo & Personas',
    tecnologia: 'Tecnología & IA',
    administracion: 'Administración & Gestión'
  };

  const MENU = [
    {
      id: 'hr_ope',
      etiqueta: 'Operaciones',
      tipo: 'area'
    },
    {
      id: 'hr_com',
      etiqueta: 'Comercial',
      tipo: 'area'
    },
    {
      id: 'hr_ges',
      etiqueta: 'Gestión y organización',
      tipo: 'area'
    },
    {
      id: 'hr_per',
      etiqueta: 'Personas',
      tipo: 'area'
    },
    {
      id: 'hr_tec',
      etiqueta: 'Tecnología',
      tipo: 'area'
    },
    {
      id: 'seccion_aptitudes',
      etiqueta: 'Aptitudes',
      tipo: 'aptitudes'
    },
    {
      id: 'seccion_sectores',
      etiqueta: 'Sectores',
      tipo: 'sectores'
    },
    {
      id: 'seccion_nodos',
      etiqueta: 'Conocimiento',
      tipo: 'conocimiento'
    },
    {
      id: 'seccion_arbol',
      etiqueta: 'Árbol',
      tipo: 'arbol'
    }
  ];

  /* ============================================================
     UTILIDADES
     ============================================================ */

  function normalizar(valor) {
    return String(valor ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function escapar(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function porId(lista, id) {
    return (lista || [])
      .find(x => x.id === id) || null;
  }

  function obtenerArea(id) {
    return porId(
      DATOS?.areas_hr,
      id
    );
  }

  function obtenerSector(id) {
    return porId(
      DATOS?.sectores,
      id
    );
  }

  function obtenerAptitud(id) {

    for (
      const lista
      of Object.values(
        DATOS?.aptitudes || {}
      )
    ) {

      const encontrada =
        porId(lista, id);

      if (encontrada) {
        return encontrada;
      }
    }

    return null;
  }

  function obtenerNodo(id) {
    return porId(
      DATOS?.nodos_conocimiento,
      id
    );
  }

  function nombreArea(id) {
    return (
      obtenerArea(id)?.nombre ||
      id
    );
  }

  function nombreSector(id) {
    return (
      obtenerSector(id)?.nombre ||
      id
    );
  }

  function nombreAptitud(id) {
    return (
      obtenerAptitud(id)?.nombre ||
      id
    );
  }

  function categoriaAptitud(id) {

    for (
      const [clave, lista]
      of Object.entries(
        DATOS?.aptitudes || {}
      )
    ) {

      if (
        (lista || [])
          .some(x => x.id === id)
      ) {
        return clave;
      }
    }

    return null;
  }

  /* ============================================================
     RELACIONES REALES
     ============================================================ */

  function nodosDeArea(id) {

    return (
      DATOS?.nodos_conocimiento || []
    )
      .filter(
        n =>
          (n.id_areas || [])
            .includes(id)
      );
  }

  function nodosDeAptitud(id) {

    return (
      DATOS?.nodos_conocimiento || []
    )
      .filter(
        n =>
          (n.id_aptitudes || [])
            .includes(id)
      );
  }

  function nodosDeSector(id) {

    return (
      DATOS?.nodos_conocimiento || []
    )
      .filter(
        n =>
          (n.id_sectores || [])
            .includes(id)
      );
  }

  /*
   * Devuelve todas las relaciones que tiene una referencia.
   */
  function relacionesReferencia(n) {

    return {
      areas: new Set(
        n?.id_areas || []
      ),

      aptitudes: new Set(
        n?.id_aptitudes || []
      ),

      sectores: new Set(
        n?.id_sectores || []
      ),

      referencias: new Set(
        n ? [n.id] : []
      ),

      categoriasAptitud:
        new Set(
          (n?.id_aptitudes || [])
            .map(categoriaAptitud)
            .filter(Boolean)
        )
    };
  }

  /*
   * Construye un foco a partir de una referencia concreta.
   *
   * EJEMPLO:
   *
   * experiencia X
   *    ↓
   * áreas relacionadas
   * aptitudes relacionadas
   * sectores relacionados
   */
  function focoReferencia(id) {

    const n =
      obtenerNodo(id);

    if (!n) {
      return null;
    }

    return relacionesReferencia(n);
  }

  /*
   * Construye un foco a partir de un área.
   */
  function focoArea(id) {

    const refs =
      nodosDeArea(id);

    const foco = {

      areas:
        new Set([id]),

      aptitudes:
        new Set(),

      sectores:
        new Set(),

      referencias:
        new Set(),

      categoriasAptitud:
        new Set()
    };

    refs.forEach(n => {

      foco.referencias.add(
        n.id
      );

      (n.id_aptitudes || [])
        .forEach(a => {

          foco.aptitudes.add(a);

          const cat =
            categoriaAptitud(a);

          if (cat) {
            foco.categoriasAptitud.add(
              cat
            );
          }
        });

      (n.id_sectores || [])
        .forEach(s =>
          foco.sectores.add(s)
        );
    });

    return foco;
  }

  /*
   * Construye un foco a partir de una aptitud.
   */
  function focoAptitud(id) {

    const refs =
      nodosDeAptitud(id);

    const foco = {

      areas:
        new Set(),

      aptitudes:
        new Set([id]),

      sectores:
        new Set(),

      referencias:
        new Set(),

      categoriasAptitud:
        new Set()
    };

    const categoria =
      categoriaAptitud(id);

    if (categoria) {
      foco.categoriasAptitud.add(
        categoria
      );
    }

    refs.forEach(n => {

      foco.referencias.add(
        n.id
      );

      (n.id_areas || [])
        .forEach(a =>
          foco.areas.add(a)
        );

      (n.id_sectores || [])
        .forEach(s =>
          foco.sectores.add(s)
        );
    });

    return foco;
  }

  /*
   * Construye un foco a partir de un sector.
   */
  function focoSector(id) {

    const refs =
      nodosDeSector(id);

    const foco = {

      areas:
        new Set(),

      aptitudes:
        new Set(),

      sectores:
        new Set([id]),

      referencias:
        new Set(),

      categoriasAptitud:
        new Set()
    };

    refs.forEach(n => {

      foco.referencias.add(
        n.id
      );

      (n.id_areas || [])
        .forEach(a =>
          foco.areas.add(a)
        );

      (n.id_aptitudes || [])
        .forEach(a => {

          foco.aptitudes.add(a);

          const cat =
            categoriaAptitud(a);

          if (cat) {
            foco.categoriasAptitud.add(
              cat
            );
          }
        });
    });

    return foco;
  }

  /* ============================================================
     NODOS MARKMAP
     ============================================================ */

  function crearNodo(
    texto,
    hijos = [],
    payload = {},
    fold = 1
  ) {

    return {

      content:
        escapar(texto),

      children:
        hijos,

      payload: {
        ...payload,
        fold
      }
    };
  }

  function crearNodoReferencia(n) {

    return crearNodo(
      n.titulo,
      [],
      {
        tipo: 'referencia',
        refId: n.id
      },
      1
    );
  }

  /* ============================================================
     RAMA ÁREAS
     ============================================================ */

  function construirRamaAreas(
    foco
  ) {

    return (
      DATOS.areas_hr || []
    )
      .map(area => {

        const referencias =
          nodosDeArea(
            area.id
          );

        const hijos =
          referencias.map(
            crearNodoReferencia
          );

        const abrir =
          foco?.areas?.has(
            area.id
          );

        hijos.forEach(
          hijo => {

            if (
              foco?.referencias?.has(
                hijo.payload.refId
              )
            ) {

              hijo.payload.fold = 0;
            }
          }
        );

        return crearNodo(
          area.nombre,
          hijos,
          {
            tipo: 'area',
            refId: area.id
          },
          abrir ? 0 : 1
        );
      });
  }

  /* ============================================================
     RAMA APTITUDES
     ============================================================ */

  function construirRamaAptitudes(
    foco
  ) {

    return Object.entries(
      DATOS.aptitudes || {}
    )
      .map(
        ([categoria, lista]) => {

          const hijos =
            (lista || [])
              .map(
                apt => {

                  const abrir =
                    foco?.aptitudes?.has(
                      apt.id
                    );

                  return crearNodo(
                    apt.nombre,
                    [],
                    {
                      tipo: 'aptitud',
                      refId: apt.id
                    },
                    abrir ? 0 : 1
                  );
                }
              );

          const abrirCategoria =
            foco?.categoriasAptitud
              ?.has(categoria);

          return crearNodo(
            CATEGORIAS_APTITUD[
              categoria
            ] || categoria,
            hijos,
            {
              tipo:
                'categoria_aptitud',
              refId: categoria
            },
            abrirCategoria
              ? 0
              : 1
          );
        }
      );
  }

  /* ============================================================
     RAMA SECTORES
     ============================================================ */

  function construirRamaSectores(
    foco
  ) {

    return (
      DATOS.sectores || []
    )
      .map(
        sector => {

          const abrir =
            foco?.sectores?.has(
              sector.id
            );

          return crearNodo(
            sector.nombre,
            [],
            {
              tipo: 'sector',
              refId: sector.id
            },
            abrir ? 0 : 1
          );
        }
      );
  }

  /* ============================================================
     ÁRBOL COMPLETO
     ============================================================ */

  function construirArbol(
    foco = null
  ) {

    const perfil =
      DATOS?.perfil || {};

    const identidad =
      crearNodo(
        perfil.identidad_profesional ||
          'Estabilizador operativo transversal',
        [
          crearNodo(
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
      crearNodo(
        RAMAS.areas,
        construirRamaAreas(
          foco
        ),
        {
          tipo: 'areas'
        },
        foco?.areas?.size
          ? 0
          : 1
      );

    const aptitudes =
      crearNodo(
        RAMAS.aptitudes,
        construirRamaAptitudes(
          foco
        ),
        {
          tipo: 'aptitudes'
        },
        foco?.aptitudes?.size
          ? 0
          : 1
      );

    const sectores =
      crearNodo(
        RAMAS.sectores,
        construirRamaSectores(
          foco
        ),
        {
          tipo: 'sectores'
        },
        foco?.sectores?.size
          ? 0
          : 1
      );

    return crearNodo(
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

  /* ============================================================
     RENDER DEL MAPA
     ============================================================ */

  function renderArbol(
    foco = null,
    nivel = NIVEL_INICIAL
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

    if (!svg) {
      return;
    }

    svg.innerHTML = '';

    mapa =
      window.markmap.Markmap.create(
        '#mapa',
        {
          autoFit: true,
          initialExpandLevel:
            nivel,
          duration: DURACION,
          maxWidth: 260,
          spacingHorizontal: 52,
          spacingVertical: 5,
          zoom: true,
          pan: true
        },
        construirArbol(foco)
      );

    estado.foco =
      foco;

    setTimeout(
      () => {

        instalarInteraccionArbol();

        resaltarFoco(
          foco
        );

      },
      DURACION + 70
    );
  }

  /* ============================================================
     RESALTADO
     ============================================================ */

  function resaltarFoco(
    foco
  ) {

    document
      .querySelectorAll(
        '#mapa .markmap-node'
      )
      .forEach(
        elemento => {

          elemento.classList.remove(
            'nodo-activo'
          );
        }
      );

    if (
      !foco?.referencias?.size
    ) {
      return;
    }

    document
      .querySelectorAll(
        '#mapa .markmap-node'
      )
      .forEach(
        elemento => {

          const texto =
            normalizar(
              elemento
                .querySelector(
                  'text'
                )
                ?.textContent || ''
            );

          for (
            const id
            of foco.referencias
          ) {

            const n =
              obtenerNodo(id);

            if (
              n &&
              normalizar(
                n.titulo
              ) === texto
            ) {

              elemento.classList.add(
                'nodo-activo'
              );

              break;
            }
          }
        }
      );
  }

  /* ============================================================
     IDENTIFICACIÓN DE RAMA
     ============================================================ */

  function ramaPrincipalDeTexto(
    texto
  ) {

    const q =
      normalizar(texto);

    if (
      q ===
      normalizar(
        RAMAS.areas
      )
    ) {
      return 'areas';
    }

    if (
      q ===
      normalizar(
        RAMAS.aptitudes
      )
    ) {
      return 'aptitudes';
    }

    if (
      q ===
      normalizar(
        RAMAS.sectores
      )
    ) {
      return 'sectores';
    }

    if (
      q ===
      normalizar(
        RAMAS.identidad
      )
    ) {
      return 'identidad';
    }

    /*
     * Área
     */
    if (
      (DATOS.areas_hr || [])
        .some(
          a =>
            normalizar(
              a.nombre
            ) === q
        )
    ) {
      return 'areas';
    }

    /*
     * Aptitud
     */
    if (
      Object
        .values(
          DATOS.aptitudes || {}
        )
        .flat()
        .some(
          a =>
            normalizar(
              a.nombre
            ) === q
        )
    ) {
      return 'aptitudes';
    }

    /*
     * Sector
     */
    if (
      (DATOS.sectores || [])
        .some(
          s =>
            normalizar(
              s.nombre
            ) === q
        )
    ) {
      return 'sectores';
    }

    /*
     * Referencia:
     * buscamos por ID real.
     */
    const n =
      (
        DATOS.nodos_conocimiento ||
        []
      )
        .find(
          x =>
            normalizar(
              x.titulo
            ) === q
        );

    if (n) {

      const areas =
        n.id_areas || [];

      const aptitudes =
        n.id_aptitudes || [];

      const sectores =
        n.id_sectores || [];

      /*
       * Para una navegación manual
       * elegimos la primera rama real
       * de la referencia.
       *
       * El botón "Ver en árbol" no
       * utiliza esta función: utiliza
       * todas las relaciones.
       */

      if (areas.length) {
        return 'areas';
      }

      if (aptitudes.length) {
        return 'aptitudes';
      }

      if (sectores.length) {
        return 'sectores';
      }
    }

    return null;
  }

  /* ============================================================
     INTERACCIÓN MANUAL DEL ÁRBOL
     ============================================================ */

  function instalarInteraccionArbol() {

    document
      .querySelectorAll(
        '#mapa .markmap-node'
      )
      .forEach(
        elemento => {

          if (
            elemento.dataset.v7 ===
            '1'
          ) {
            return;
          }

          elemento.dataset.v7 =
            '1';

          elemento.addEventListener(
            'click',
            evento => {

              const texto =
                (
                  elemento
                    .querySelector(
                      'text'
                    )
                    ?.textContent ||
                  ''
                ).trim();

              if (!texto) {
                return;
              }

              const rama =
                ramaPrincipalDeTexto(
                  texto
                );

              if (!rama) {
                return;
              }

              /*
               * Si estamos cambiando
               * de rama principal:
               *
               * reconstruimos el árbol.
               *
               * Así la rama anterior
               * desaparece contraída.
               */
              if (
                estado.rama &&
                estado.rama !== rama
              ) {

                evento.stopPropagation();

                estado.rama =
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
                  20
                );

                return;
              }

              estado.rama =
                rama;

              /*
               * Dentro de la misma rama,
               * Markmap conserva la
               * expansión normal.
               */
              setTimeout(
                () => {

                  resaltarFoco(
                    estado.foco
                  );

                },
                DURACION + 20
              );
            },
            true
          );
        }
      );
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
          DATOS.areas_hr ||
          []
        )
          .find(
            x =>
              normalizar(
                x.nombre
              ) === q
          );

      if (a) {
        return focoArea(
          a.id
        );
      }

      const n =
        (
          DATOS.nodos_conocimiento ||
          []
        )
          .find(
            x =>
              normalizar(
                x.titulo
              ) === q
          );

      if (n) {
        return focoReferencia(
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
        return focoAptitud(
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
          DATOS.sectores ||
          []
        )
          .find(
            x =>
              normalizar(
                x.nombre
              ) === q
          );

      if (s) {
        return focoSector(
          s.id
        );
      }
    }

    return null;
  }

  /* ============================================================
     VISTAS
     ============================================================ */

  function mostrarContenido() {

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

    estado.modo =
      'contenido';
  }

  function mostrarArbolVista() {

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

    estado.modo =
      'arbol';
  }

  /* ============================================================
     MENÚ
     ============================================================ */

  function activarMenu(id) {

    document
      .querySelectorAll(
        '.menu-btn'
      )
      .forEach(
        boton => {

          boton.classList.toggle(
            'activo',
            boton.dataset.id === id
          );
        }
      );
  }

  function escribirContenido(
    html
  ) {

    const contexto =
      document.getElementById(
        'contexto'
      );

    if (!contexto) {
      return;
    }

    contexto.innerHTML =
      html;

    contexto.scrollTop =
      0;
  }

  function mensaje(texto) {

    escribirContenido(`
      <div class="contexto-vacio">
        ${escapar(texto)}
      </div>
    `);
  }

  /* ============================================================
     BOTÓN "VER EN ÁRBOL"
     ============================================================ */

  function botonVerMapa(
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

  /* ============================================================
     TARJETA DE REFERENCIA
     ============================================================ */

  function tarjetaReferencia(
    n
  ) {

    let borde =
      '#FF9900';

    const tipo =
      normalizar(
        n.tipo
      );

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
        style="
          border-left:
          4px solid ${borde};
        ">

        <div class="item-cabecera">

          <b>
            ${escapar(n.titulo)}
          </b>

          <span
            class="item-badge"
            style="
              background:
              ${borde};
            ">

            ${escapar(
              String(
                n.tipo ||
                'referencia'
              ).toUpperCase()
            )}

          </span>

        </div>
    `;

    if (n.periodo) {

      html += `
        <div class="item-periodo">
          ${escapar(
            n.periodo
          )}
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

    const relaciones = [

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
        'Aptitudes demostradas',
        (n.id_aptitudes || [])
          .map(nombreAptitud)
      ],

      [
        'Sectores relacionados',
        (n.id_sectores || [])
          .map(nombreSector)
      ],

      [
        'Palabras clave',
        n.palabras_clave
      ]

    ];

    relaciones.forEach(
      ([titulo, valor]) => {

        if (
          valor &&
          (
            !Array.isArray(valor) ||
            valor.length
          )
        ) {

          html += `
            <div class="ctx-label">
              ${escapar(
                titulo
              )}
            </div>

            <div>
              ${escapar(
                Array.isArray(
                  valor
                )
                  ? valor.join(
                      ', '
                    )
                  : valor
              )}
            </div>
          `;
        }
      }
    );

    html += `

        <div class="item-accion">

          ${botonVerMapa(
            'referencia',
            n.id
          )}

        </div>

      </article>
    `;

    return html;
  }

  /* ============================================================
     APTITUD
     ============================================================ */

  function tarjetaAptitud(
    a
  ) {

    const referencias =
      nodosDeAptitud(
        a.id
      );

    const categoria =
      categoriaAptitud(
        a.id
      );

    let html = `
      <article class="item">

        <div class="item-cabecera">

          <b>
            ${escapar(
              a.nombre
            )}
          </b>

          <span class="item-categoria">
            ${escapar(
              CATEGORIAS_APTITUD[
                categoria
              ] || categoria || ''
            )}
          </span>

        </div>

        <div class="item-descripcion">

          Capacidad profesional
          vinculada a
          ${referencias.length}
          referencia(s)
          documentada(s).

        </div>

        <div class="ctx-label">

          Referencias que la sustentan ·
          ${referencias.length}

        </div>
    `;

    referencias.forEach(
      n => {

        html += `
          <div class="referencia-linea">

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
        `;
      }
    );

    html += `

        <div class="item-accion">

          ${botonVerMapa(
            'aptitud',
            a.id
          )}

        </div>

      </article>
    `;

    return html;
  }

  /* ============================================================
     SECTOR
     ============================================================ */

  function tarjetaSector(
    s
  ) {

    const referencias =
      nodosDeSector(
        s.id
      );

    let html = `
      <article class="item">

        <div class="item-cabecera">

          <b>
            ${escapar(
              s.nombre
            )}
          </b>

        </div>

        <div class="item-descripcion">

          ${referencias.length}
          referencia(s)
          profesional(es)
          asociada(s).

        </div>

        <div class="ctx-label">
          Referencias
        </div>
    `;

    referencias.forEach(
      n => {

        html += `
          <div class="referencia-linea">

            ${escapar(
              n.titulo
            )}

          </div>
        `;
      }
    );

    html += `

        <div class="item-accion">

          ${botonVerMapa(
            'sector',
            s.id
          )}

        </div>

      </article>
    `;

    return html;
  }

  /* ============================================================
     VISTA ÁREA
     ============================================================ */

  function mostrarArea(
    a
  ) {

    mostrarContenido();

    activarMenu(
      a.id
    );

    const referencias =
      nodosDeArea(
        a.id
      );

    let html = `

      <div class="ctx-titulo">
        ${escapar(
          a.nombre
        )}
      </div>

      <div class="ctx-desc">

        Experiencias, conocimientos
        y evidencias vinculadas a
        esta área profesional.

      </div>

      <div class="ctx-label">

        Referencias relacionadas ·
        ${referencias.length}

      </div>

    `;

    referencias.forEach(
      n => {

        html +=
          tarjetaReferencia(n);

      }
    );

    escribirContenido(
      html
    );
  }

  /* ============================================================
     VISTA APTITUDES
     ============================================================ */

  function mostrarAptitudes() {

    mostrarContenido();

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
      const [
        categoria,
        lista
      ]
      of Object.entries(
        DATOS.aptitudes || {}
      )
    ) {

      html += `

        <div class="ctx-label">

          ${escapar(
            CATEGORIAS_APTITUD[
              categoria
            ] || categoria
          )}

        </div>

      `;

      (lista || []).forEach(
        a => {

          html +=
            tarjetaAptitud(
              a
            );
        }
      );
    }

    escribirContenido(
      html
    );
  }

  /* ============================================================
     VISTA SECTORES
     ============================================================ */

  function mostrarSectores() {

    mostrarContenido();

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

        html +=
          tarjetaSector(s);

      }
    );

    escribirContenido(
      html
    );
  }

  /* ============================================================
     VISTA CONOCIMIENTO
     ============================================================ */

  function mostrarConocimiento() {

    mostrarContenido();

    activarMenu(
      'seccion_nodos'
    );

    const referencias =
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
        ${referencias.length}

      </div>

    `;

    referencias.forEach(
      n => {

        html +=
          tarjetaReferencia(
            n
          );
      }
    );

    escribirContenido(
      html
    );
  }

  /* ============================================================
     BÚSQUEDA
     ============================================================ */

  function buscar(
    consulta
  ) {

    const q =
      normalizar(
        consulta
      ).trim();

    const resultado = {

      areas: [],

      sectores: [],

      aptitudes: [],

      referencias: []

    };

    if (!q) {
      return resultado;
    }

    (
      DATOS.areas_hr || []
    ).forEach(
      a => {

        if (
          normalizar(
            a.nombre
          ).includes(q)
        ) {

          resultado.areas.push(
            a
          );
        }
      }
    );

    (
      DATOS.sectores || []
    ).forEach(
      s => {

        if (
          normalizar(
            s.nombre
          ).includes(q)
        ) {

          resultado.sectores.push(
            s
          );
        }
      }
    );

    for (
      const lista
      of Object.values(
        DATOS.aptitudes || {}
      )
    ) {

      (lista || [])
        .forEach(
          a => {

            if (
              normalizar(
                a.nombre
              ).includes(q)
            ) {

              resultado.aptitudes.push(
                a
              );
            }
          }
        );
    }

    (
      DATOS.nodos_conocimiento ||
      []
    ).forEach(
      n => {

        const texto = [

          n.titulo,

          n.descripcion,

          n.tipo,

          n.periodo,

          n.entidades,

          n.palabras_clave,

          (n.id_areas || [])
            .map(nombreArea),

          (n.id_aptitudes || [])
            .map(nombreAptitud),

          (n.id_sectores || [])
            .map(nombreSector)

        ];

        const encontrado =
          texto.some(
            valor =>
              normalizar(
                Array.isArray(
                  valor
                )
                  ? valor.join(
                      ' '
                    )
                  : valor
              ).includes(q)
          );

        if (encontrado) {

          resultado.referencias
            .push(n);

        }
      }
    );

    return resultado;
  }

  function mostrarResultados(
    resultado,
    consulta
  ) {

    mostrarContenido();

    const total =
      resultado.areas.length +
      resultado.sectores.length +
      resultado.aptitudes.length +
      resultado.referencias.length;

    if (!total) {

      mensaje(
        `Sin resultados para «${consulta}».`
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
        «${escapar(
          consulta
        )}».

      </div>

    `;

    resultado.areas
      .forEach(
        a => {

          html += `

            <article class="item">

              <b>
                ${escapar(
                  a.nombre
                )}
              </b>

              <div class="item-accion">

                ${botonVerMapa(
                  'area',
                  a.id
                )}

              </div>

            </article>

          `;
        }
      );

    resultado.aptitudes
      .forEach(
        a => {

          html +=
            tarjetaAptitud(a);

        }
      );

    resultado.sectores
      .forEach(
        s => {

          html +=
            tarjetaSector(s);

        }
      );

    resultado.referencias
      .forEach(
        n => {

          html +=
            tarjetaReferencia(n);

        }
      );

    escribirContenido(
      html
    );
  }

  /* ============================================================
     NAVEGACIÓN DEL MENÚ
     ============================================================ */

  function renderMenu() {

    const menu =
      document.getElementById(
        'menu'
      );

    if (!menu) {
      return;
    }

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
      .forEach(
        boton => {

          boton.addEventListener(
            'click',
            () => {

              if (
                boton.dataset.tipo ===
                'arbol'
              ) {

                mostrarVistaArbol();

                return;
              }

              if (
                boton.dataset.tipo ===
                'area'
              ) {

                const a =
                  obtenerArea(
                    boton.dataset.id
                  );

                if (a) {
                  mostrarArea(a);
                }

                return;
              }

              if (
                boton.dataset.tipo ===
                'aptitudes'
              ) {

                mostrarAptitudes();

                return;
              }

              if (
                boton.dataset.tipo ===
                'sectores'
              ) {

                mostrarSectores();

                return;
              }

              if (
                boton.dataset.tipo ===
                'conocimiento'
              ) {

                mostrarConocimiento();

              }
            }
          );
        }
      );
  }

  /* ============================================================
     VISTA ÁRBOL
     ============================================================ */

  function mostrarVistaArbol(
    foco = null
  ) {

    mostrarArbolVista();

    estado.rama =
      null;

    estado.foco =
      foco;

    renderArbol(
      foco,
      NIVEL_INICIAL
    );
  }

  /* ============================================================
     VOLVER AL MENÚ
     ============================================================ */

  function volverMenu() {

    mostrarContenido();

    activarMenu('');

    estado.rama =
      null;

    estado.foco =
      null;

    mensaje(
      'Selecciona una categoría o utiliza el buscador.'
    );
  }

  /* ============================================================
     CONTROLES ÁRBOL
     ============================================================ */

  function conectarControlesArbol() {

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

          mostrarArbolVista();

          estado.rama =
            null;

          estado.foco =
            null;

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

          mostrarArbolVista();

          estado.rama =
            null;

          estado.foco =
            null;

          renderArbol(
            null,
            NIVEL_INICIAL
          );
        }
      );

    document
      .getElementById(
        'btn-limpiar'
      )
      ?.addEventListener(
        'click',
        () => {

          const buscador =
            document.getElementById(
              'buscador'
            );

          if (buscador) {
            buscador.value = '';
          }

          estado.rama =
            null;

          estado.foco =
            null;

          activarMenu(
            'seccion_arbol'
          );

          mostrarVistaArbol();

        }
      );
  }

  /* ============================================================
     EVENTO VER EN ÁRBOL
     ============================================================ */

  function conectarVerEnArbol() {

    document.addEventListener(
      'click',
      evento => {

        const boton =
          evento.target.closest(
            '.btn-ver-arbol'
          );

        if (!boton) {
          return;
        }

        const tipo =
          boton.dataset.tipoRef;

        const id =
          boton.dataset.refId;

        let foco = null;

        if (
          tipo ===
          'referencia'
        ) {

          foco =
            focoReferencia(id);

        } else if (
          tipo ===
          'area'
        ) {

          foco =
            focoArea(id);

        } else if (
          tipo ===
          'aptitud'
        ) {

          foco =
            focoAptitud(id);

        } else if (
          tipo ===
          'sector'
        ) {

          foco =
            focoSector(id);
        }

        if (!foco) {
          return;
        }

        activarMenu(
          'seccion_arbol'
        );

        mostrarArbolVista();

        estado.rama =
          null;

        estado.foco =
          foco;

        /*
         * Aquí se abren TODAS las
         * relaciones reales de la
         * referencia.
         */
        renderArbol(
          foco,
          1
        );
      }
    );
  }

  /* ============================================================
     BUSCADOR
     ============================================================ */

  function conectarBuscador() {

    const buscador =
      document.getElementById(
        'buscador'
      );

    if (!buscador) {
      return;
    }

    buscador.addEventListener(
      'input',
      evento => {

        const q =
          evento.target.value.trim();

        if (!q) {

          volverMenu();

          return;
        }

        mostrarResultados(
          buscar(q),
          q
        );
      }
    );
  }

  /* ============================================================
     CABECERA
     ============================================================ */

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

    const experiencia =
      document.getElementById(
        'm-exp'
      );

    const habilidades =
      document.getElementById(
        'm-sec'
      );

    if (experiencia) {

      experiencia.textContent =
        `${Number(
          magnitudes.anos_experiencia ||
          35
        )}+`;
    }

    if (habilidades) {

      habilidades.textContent =
        `${Number(
          magnitudes.habilidades ||
          20
        )}+`;
    }

    /*
     * La tercera magnitud ya no
     * forma parte de la cabecera
     * acordada.
     */
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

  /* ============================================================
     INICIO
     ============================================================ */

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

      conectarControlesArbol();

      conectarVerEnArbol();

      mostrarContenido();

      mensaje(
        'Selecciona una categoría o utiliza el buscador.'
      );

      console.log(
        '✓ MiguelMapa v7 cargado correctamente.'
      );

    } catch (error) {

      console.error(
        'Error cargando knowledge-base.json:',
        error
      );

      mostrarContenido();

      mensaje(
        'No se pudo cargar knowledge-base.json.'
      );
    }
  }

  /* ============================================================
     API PÚBLICA
     ============================================================ */

  window.MiguelMapa = {

    buscar,

    construirArbol,

    renderArbol,

    mostrarVistaArbol,

    volverMenu,

    focoReferencia,

    focoArea,

    focoAptitud,

    focoSector

  };

  document.addEventListener(
    'DOMContentLoaded',
    iniciar
  );

})();
