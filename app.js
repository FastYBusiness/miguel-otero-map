(() => {
  'use strict';

  const DURACION = 220;

  const RAMAS = new Set([
    'Estabilizador Operativo de Valor Transversal',
    'Estabilizador operativo transversal',
    'Áreas de Gestión',
    'Aptitudes Transversales',
    'Sectores de Aplicación'
  ]);

  let DATOS = null;
  let mapa = null;

  const norm = s => String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function area(id) {
    return (DATOS?.areas_hr || []).find(x => x.id === id) || null;
  }

  function sector(id) {
    return (DATOS?.sectores || []).find(x => x.id === id) || null;
  }

  function aptitud(id) {
    for (const lista of Object.values(DATOS?.aptitudes || {})) {
      const x = (lista || []).find(a => a.id === id);
      if (x) return x;
    }
    return null;
  }

  const areaName = id => area(id)?.nombre || id;
  const sectorName = id => sector(id)?.nombre || id;
  const aptitudName = id => aptitud(id)?.nombre || id;

  function nodosArea(id) {
    return (DATOS?.nodos_conocimiento || [])
      .filter(n => (n.id_areas || []).includes(id));
  }

  function nodosSector(id) {
    return (DATOS?.nodos_conocimiento || [])
      .filter(n => (n.id_sectores || []).includes(id));
  }

  function nodosAptitud(id) {
    return (DATOS?.nodos_conocimiento || [])
      .filter(n => (n.id_aptitudes || []).includes(id));
  }

  function coincide(campo, q) {
    if (!campo || !q) return false;

    const texto = Array.isArray(campo)
      ? campo.join(' ')
      : campo;

    return norm(texto).includes(norm(q));
  }

  function buscar(q) {
    const r = {
      areas: [],
      sectores: [],
      aptitudes: [],
      nodos: []
    };

    if (!q) return r;

    (DATOS.areas_hr || []).forEach(x => {
      if (coincide(x.nombre, q)) {
        r.areas.push(x);
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
      const campos = [
        n.titulo,
        n.descripcion,
        n.entidades,
        n.periodo,
        n.tipo,
        n.palabras_clave,
        (n.id_areas || []).map(areaName),
        (n.id_sectores || []).map(sectorName),
        (n.id_aptitudes || []).map(aptitudName)
      ];

      if (campos.some(x => coincide(x, q))) {
        r.nodos.push(n);
      }
    });

    return r;
  }

  function nodo(
    content,
    children = [],
    payload = {},
    fold = undefined
  ) {
    const n = {
      content: esc(content),
      children
    };

    n.payload = {
      ...payload
    };

    if (fold !== undefined) {
      n.payload.fold = fold;
    }

    return n;
  }

  function ramaArea(x) {
    return nodo(
      x.nombre,
      nodosArea(x.id).map(n =>
        nodo(
          n.titulo,
          [],
          {
            refId: n.id,
            tipo: 'conocimiento'
          },
          1
        )
      ),
      {
        refId: x.id,
        tipo: 'area'
      },
      1
    );
  }

  function ramaAptitudes() {
    const nombres = {
      operacion: 'Operación & Logística',
      comercial: 'Comercial & Negocio',
      liderazgo: 'Liderazgo & Personas',
      tecnologia: 'Tecnología & IA',
      administracion: 'Administración & Gestión'
    };

    return Object.entries(
      DATOS.aptitudes || {}
    ).map(([k, lista]) =>
      nodo(
        nombres[k] || k,
        (lista || []).map(a =>
          nodo(
            a.nombre,
            [],
            {
              refId: a.id,
              tipo: 'aptitud'
            },
            1
          )
        ),
        {
          tipo: 'categoria_aptitud',
          refId: k
        },
        1
      )
    );
  }

  function construirArbol(foco = '') {
    const p = DATOS.perfil || {};

    const identidad = nodo(
      p.identidad_profesional ||
        'Estabilizador operativo transversal',
      [
        nodo(p.mision || '')
      ],
      {
        tipo: 'identidad'
      },
      1
    );

    const areas = nodo(
      'Áreas de Gestión',
      (DATOS.areas_hr || []).map(ramaArea),
      {
        tipo: 'areas'
      },
      1
    );

    const aptitudes = nodo(
      'Aptitudes Transversales',
      ramaAptitudes(),
      {
        tipo: 'aptitudes'
      },
      1
    );

    const sectores = nodo(
      'Sectores de Aplicación',
      (DATOS.sectores || []).map(s =>
        nodo(
          s.nombre,
          [],
          {
            refId: s.id,
            tipo: 'sector'
          },
          1
        )
      ),
      {
        tipo: 'sectores'
      },
      1
    );

    const raiz = nodo(
      p.nombre ||
        'Miguel Otero Cabaleiro',
      [
        identidad,
        areas,
        aptitudes,
        sectores
      ],
      {
        tipo: 'raiz'
      }
    );

    if (foco) {
      abrirCamino(
        raiz,
        foco
      );
    }

    return raiz;
  }

  function texto(n) {
    return norm(
      String(n?.content || '')
        .replace(/<[^>]*>/g, '')
    );
  }

  function abrirCamino(
    raiz,
    foco
  ) {
    const q = norm(foco);

    if (!q) return false;

    function rec(n, padres) {
      if (texto(n).includes(q)) {

        padres.forEach(p => {
          p.payload = {
            ...(p.payload || {}),
            fold: 0
          };
        });

        if (n.children?.length) {
          n.payload = {
            ...(n.payload || {}),
            fold: 0
          };
        }

        return true;
      }

      return (n.children || [])
        .some(h =>
          rec(
            h,
            [...padres, n]
          )
        );
    }

    return rec(
      raiz,
      []
    );
  }

  function renderArbol(
    foco = ''
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

    mapa =
      window.markmap.Markmap.create(
        '#mapa',
        {
          autoFit: true,
          initialExpandLevel: 0,
          duration: DURACION,
          maxWidth: 230,
          spacingHorizontal: 48,
          spacingVertical: 4,
          zoom: true,
          pan: true
        },
        construirArbol(foco)
      );

    if (foco) {
      setTimeout(
        () => resaltar(foco),
        DURACION + 80
      );
    }

    instalarRamas();
  }

  function resaltar(q) {
    const objetivo =
      norm(q);

    let encontrado = null;

    document
      .querySelectorAll(
        '#mapa .markmap-node'
      )
      .forEach(el => {

        el.classList.remove(
          'nodo-activo'
        );

        const t = norm(
          el.querySelector(
            'text'
          )?.textContent || ''
        );

        if (
          !encontrado &&
          t.includes(objetivo)
        ) {
          encontrado = el;
        }
      });

    if (encontrado) {
      encontrado.classList.add(
        'nodo-activo'
      );
    }
  }

  function vistaContenido() {
    const l =
      document.querySelector(
        '.lateral'
      );

    const z =
      document.querySelector(
        '.zona-arbol'
      );

    if (!l || !z) return;

    l.style.display = 'flex';
    l.style.width = '100%';
    l.style.minWidth = '0';

    z.style.display = 'none';

    document.body.classList.add(
      'vista-contenido'
    );

    document.body.classList.remove(
      'vista-arbol'
    );
  }

  function vistaArbol() {
    const l =
      document.querySelector(
        '.lateral'
      );

    const z =
      document.querySelector(
        '.zona-arbol'
      );

    if (!l || !z) return;

    l.style.display = 'none';
    z.style.display = 'flex';

    document.body.classList.add(
      'vista-arbol'
    );

    document.body.classList.remove(
      'vista-contenido'
    );
  }

  function menuActivo(id) {
    document
      .querySelectorAll(
        '.menu-btn'
      )
      .forEach(b =>
        b.classList.toggle(
          'activo',
          b.dataset.id === id
        )
      );
  }

  function contenido(html) {
    const c =
      document.getElementById(
        'contexto'
      );

    if (c) {
      c.innerHTML = html;
    }
  }

  function botonArbol(
    texto,
    id = ''
  ) {
    return `
      <button
        type="button"
        class="btn-herramienta btn-ver-arbol"
        data-foco="${esc(texto)}"
        data-ref-id="${esc(id)}">
        Ver en árbol
      </button>
    `;
  }

  function tarjetaNodo(n) {
    const tipo =
      norm(n.tipo);

    const colores = {
      experiencia: '#007185',
      formacion: '#2e7d32',
      capacitacion: '#d32f2f',
      evidencia: '#6a1b9a'
    };

    const color =
      colores[tipo] ||
      '#FF9900';

    let h = `
      <article
        class="item"
        style="border-left:4px solid ${color}">

        <div class="item-cabecera">

          <b>${esc(n.titulo)}</b>

          <span
            class="item-badge"
            style="background:${color}">

            ${esc(
              (
                n.tipo ||
                'nodo'
              ).toUpperCase()
            )}

          </span>

        </div>
    `;

    if (n.periodo) {
      h += `
        <div class="item-periodo">
          ${esc(n.periodo)}
        </div>
      `;
    }

    if (n.descripcion) {
      h += `
        <div class="item-descripcion">
          ${esc(n.descripcion)}
        </div>
      `;
    }

    const datos = [
      [
        'Entidades / Empresas',
        n.entidades
      ],
      [
        'Áreas relacionadas',
        (n.id_areas || [])
          .map(areaName)
      ],
      [
        'Sectores relacionados',
        (n.id_sectores || [])
          .map(sectorName)
      ],
      [
        'Aptitudes demostradas',
        (n.id_aptitudes || [])
          .map(aptitudName)
      ],
      [
        'Palabras clave',
        n.palabras_clave
      ]
    ];

    datos.forEach(
      ([label, valor]) => {

        if (
          valor &&
          (
            Array.isArray(valor)
              ? valor.length
              : true
          )
        ) {

          h += `
            <div class="ctx-label">
              ${label}
            </div>

            <div>
              ${esc(
                Array.isArray(valor)
                  ? valor.join(', ')
                  : valor
              )}
            </div>
          `;
        }
      }
    );

    h += `
        <div class="item-accion">
          ${botonArbol(
            n.titulo,
            n.id
          )}
        </div>

      </article>
    `;

    return h;
  }

  function mostrarArea(x) {
    if (!x) return;

    vistaContenido();

    const ns =
      nodosArea(x.id);

    let h = `
      <div class="ctx-titulo">
        ${esc(x.nombre)}
      </div>

      <div class="ctx-desc">
        Experiencias, conocimientos y
        evidencias vinculadas a esta
        área profesional.
      </div>

      <div class="ctx-label">
        Referencias relacionadas ·
        ${ns.length}
      </div>
    `;

    ns.forEach(
      n => h += tarjetaNodo(n)
    );

    contenido(h);
  }

  function mostrarAptitudes() {
    vistaContenido();

    let h = `
      <div class="ctx-titulo">
        Aptitudes
      </div>

      <div class="ctx-desc">
        Capacidades profesionales
        consultables y vinculadas a
        referencias concretas.
      </div>
    `;

    for (
      const [cat, lista]
      of Object.entries(
        DATOS.aptitudes || {}
      )
    ) {

      h += `
        <div class="ctx-label">
          ${esc(cat)}
        </div>
      `;

      (lista || []).forEach(
        a => {

          const ns =
            nodosAptitud(a.id);

          h += `
            <article class="item">

              <div class="item-cabecera">
                <b>
                  ${esc(a.nombre)}
                </b>
              </div>

              <div class="item-descripcion">
                ${
                  ns.length
                    ? `Capacidad vinculada a ${ns.length} referencia(s) profesional(es).`
                    : 'Aptitud declarada sin referencia asociada en la base actual.'
                }
              </div>

              <div class="ctx-label">
                Referencias sólidas ·
                ${ns.length}
              </div>
          `;

          ns.forEach(
            n => {

              h += `
                <div class="referencia-linea">

                  <b>
                    ${esc(n.titulo)}
                  </b>

                  ${
                    n.periodo
                      ? `
                        <div class="item-periodo">
                          ${esc(n.periodo)}
                        </div>
                      `
                      : ''
                  }

                </div>
              `;
            }
          );

          h += `
              <div class="item-accion">
                ${botonArbol(
                  a.nombre,
                  a.id
                )}
              </div>

            </article>
          `;
        }
      );
    }

    contenido(h);
  }

  function mostrarSectores() {
    vistaContenido();

    let h = `
      <div class="ctx-titulo">
        Sectores
      </div>

      <div class="ctx-desc">
        Sectores en los que existe
        experiencia, aplicación o
        conocimiento relacionado.
      </div>
    `;

    (DATOS.sectores || [])
      .forEach(s => {

        const ns =
          nodosSector(s.id);

        h += `
          <article class="item">

            <b>
              ${esc(s.nombre)}
            </b>

            <div class="item-descripcion">
              ${ns.length}
              referencia(s)
              profesional(es)
              asociada(s).
            </div>
        `;

        ns.forEach(
          n => {

            h += `
              <div class="referencia-linea">
                ${esc(n.titulo)}
              </div>
            `;
          }
        );

        h += `
            <div class="item-accion">
              ${botonArbol(
                s.nombre,
                s.id
              )}
            </div>

          </article>
        `;
      });

    contenido(h);
  }

  function mostrarConocimiento() {
    vistaContenido();

    const ns =
      DATOS.nodos_conocimiento ||
      [];

    let h = `
      <div class="ctx-titulo">
        Conocimiento
      </div>

      <div class="ctx-desc">
        Inventario consultable de
        experiencias, formación,
        capacitación y evidencias.
      </div>

      <div class="ctx-label">
        Referencias · ${ns.length}
      </div>
    `;

    ns.forEach(
      n => h += tarjetaNodo(n)
    );

    contenido(h);
  }

  function resultados(r, q) {
    vistaContenido();

    const total =
      r.areas.length +
      r.sectores.length +
      r.aptitudes.length +
      r.nodos.length;

    if (!total) {
      contenido(`
        <div class="contexto-vacio">
          Sin resultados para
          «${esc(q)}».
        </div>
      `);

      return;
    }

    let h = `
      <div class="ctx-titulo">
        Resultados
      </div>

      <div class="ctx-desc">
        ${total}
        referencia(s) para
        «${esc(q)}».
      </div>
    `;

    r.areas.forEach(
      x => {

        h += `
          <article class="item">

            <b>
              ${esc(x.nombre)}
            </b>

            <div class="item-accion">
              ${botonArbol(
                x.nombre,
                x.id
              )}
            </div>

          </article>
        `;
      }
    );

    r.aptitudes.forEach(
      x => {

        h += `
          <article class="item">

            <b>
              ${esc(x.nombre)}
            </b>

            <div class="item-accion">
              ${botonArbol(
                x.nombre,
                x.id
              )}
            </div>

          </article>
        `;
      }
    );

    r.sectores.forEach(
      x => {

        h += `
          <article class="item">

            <b>
              ${esc(x.nombre)}
            </b>

            <div class="item-accion">
              ${botonArbol(
                x.nombre,
                x.id
              )}
            </div>

          </article>
        `;
      }
    );

    r.nodos.forEach(
      x => h += tarjetaNodo(x)
    );

    contenido(h);
  }

  const MENU = [
    [
      'hr_ope',
      'Operaciones',
      'area'
    ],
    [
      'hr_com',
      'Comercial',
      'area'
    ],
    [
      'hr_ges',
      'Gestión y organización',
      'area'
    ],
    [
      'hr_per',
      'Personas',
      'area'
    ],
    [
      'hr_tec',
      'Tecnología',
      'area'
    ],
    [
      'seccion_aptitudes',
      'Aptitudes',
      'aptitudes'
    ],
    [
      'seccion_sectores',
      'Sectores',
      'sectores'
    ],
    [
      'seccion_nodos',
      'Conocimiento',
      'conocimiento'
    ],
    [
      'seccion_arbol',
      'Árbol',
      'arbol'
    ]
  ];

  function renderMenu() {
    const m =
      document.getElementById(
        'menu'
      );

    if (!m) return;

    m.innerHTML =
      MENU.map(
        ([id, label, tipo]) =>
          `
            <button
              type="button"
              class="menu-btn"
              data-id="${id}"
              data-tipo="${tipo}">

              ${label}

            </button>
          `
      ).join('');

    m.querySelectorAll(
      '.menu-btn'
    ).forEach(
      b =>
        b.addEventListener(
          'click',
          () => {

            menuActivo(
              b.dataset.id
            );

            if (
              b.dataset.tipo ===
              'arbol'
            ) {
              return mostrarVistaArbol();
            }

            if (
              b.dataset.tipo ===
              'area'
            ) {
              return mostrarArea(
                area(b.dataset.id)
              );
            }

            if (
              b.dataset.tipo ===
              'aptitudes'
            ) {
              return mostrarAptitudes();
            }

            if (
              b.dataset.tipo ===
              'sectores'
            ) {
              return mostrarSectores();
            }

            mostrarConocimiento();
          }
        )
    );
  }

  function mostrarVistaArbol(
    foco = ''
  ) {
    vistaArbol();
    renderArbol(foco);
  }

  function volverMenu() {
    vistaContenido();
    menuActivo('');

    contenido(`
      <div class="contexto-vacio">
        Selecciona una categoría
        o utiliza el buscador.
      </div>
    `);
  }

  function instalarRamas() {
    setTimeout(
      () => {

        document
          .querySelectorAll(
            '#mapa .markmap-node'
          )
          .forEach(el => {

            const t =
              (
                el.querySelector(
                  'text'
                )?.textContent ||
                ''
              ).trim();

            if (
              !RAMAS.has(t) ||
              el.dataset.control
            ) {
              return;
            }

            el.dataset.control =
              '1';

            el.addEventListener(
              'click',
              e => {

                e.stopPropagation();

                setTimeout(
                  () =>
                    mostrarVistaArbol(t),
                  DURACION + 20
                );
              }
            );
          });

      },
      DURACION + 40
    );
  }

  function conectar() {

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

          vistaArbol();
          renderArbol();

        }
      );

    document
      .getElementById(
        'btn-contraer'
      )
      ?.addEventListener(
        'click',
        () => {

          vistaArbol();
          renderArbol();

        }
      );

    document
      .getElementById(
        'btn-limpiar'
      )
      ?.addEventListener(
        'click',
        () => {

          const b =
            document.getElementById(
              'buscador'
            );

          if (b) {
            b.value = '';
          }

          menuActivo(
            'seccion_arbol'
          );

          mostrarVistaArbol();

        }
      );

    document.addEventListener(
      'click',
      e => {

        const b =
          e.target.closest(
            '.btn-ver-arbol'
          );

        if (!b) return;

        menuActivo(
          'seccion_arbol'
        );

        mostrarVistaArbol(
          b.dataset.foco || ''
        );
      }
    );

    document
      .getElementById(
        'buscador'
      )
      ?.addEventListener(
        'input',
        e => {

          const q =
            e.target.value.trim();

          if (!q) {
            return volverMenu();
          }

          resultados(
            buscar(q),
            q
          );
        }
      );
  }

  function cabecera() {
    const p =
      DATOS.perfil || {};

    const m =
      DATOS.magnitudes || {};

    document
      .querySelector(
        '.cabecera-nombre'
      )
      .textContent =
        p.nombre ||
        'Miguel Otero Cabaleiro';

    document
      .querySelector(
        '.cabecera-titulo'
      )
      .textContent =
        'Estabilizador operativo transversal';

    document
      .getElementById(
        'm-exp'
      )
      .textContent =
        `${Number(
          m.anos_experiencia ||
          35
        )}+`;

    document
      .getElementById(
        'm-sec'
      )
      .textContent =
        `${Number(
          m.habilidades ||
          20
        )}+`;

    document
      .querySelector(
        '.cabecera-magnitudes .magnitud:nth-child(3)'
      )
      ?.remove();
  }

  async function iniciar() {

    try {

      const r =
        await fetch(
          './knowledge-base.json',
          {
            cache: 'no-store'
          }
        );

      if (!r.ok) {
        throw new Error(
          `HTTP ${r.status}`
        );
      }

      DATOS =
        await r.json();

      cabecera();
      renderMenu();
      conectar();
      volverMenu();

    } catch (e) {

      console.error(e);

      contenido(`
        <div class="contexto-vacio">
          No se pudo cargar
          knowledge-base.json.
        </div>
      `);
    }
  }

  window.MiguelMapa = {
    buscar,
    renderArbol,
    mostrarVistaArbol,
    volverMenu
  };

  document.addEventListener(
    'DOMContentLoaded',
    iniciar
  );

})();
