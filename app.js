(() => {
  'use strict';

  const DURACION_ANIMACION = 260;
  const NIVEL_ARBOL_BASE = 1;

  let DATOS = null;
  let markmapInstancia = null;

  function normalizar(texto) {
    return String(texto ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function escaparHTML(texto) {
    return String(texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escaparRegex(texto) {
    return String(texto ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function coincide(campo, queryNorm) {
    if (!campo || !queryNorm) return false;

    const patron = new RegExp(
      '(^|[^\\p{L}\\p{N}])' + escaparRegex(queryNorm),
      'u'
    );

    if (Array.isArray(campo)) {
      return campo.some(item => patron.test(normalizar(item)));
    }

    return patron.test(normalizar(campo));
  }

  function agregarSinDuplicar(lista, item) {
    if (item && !lista.some(x => x.id === item.id)) {
      lista.push(item);
    }
  }

  function obtenerArea(id) {
    return (DATOS?.areas_hr || []).find(x => x.id === id) || null;
  }

  function obtenerSector(id) {
    return (DATOS?.sectores || []).find(x => x.id === id) || null;
  }

  function obtenerAptitud(id) {
    if (!DATOS?.aptitudes) return null;

    for (const categoria of Object.values(DATOS.aptitudes)) {
      const encontrada = (categoria || []).find(x => x.id === id);
      if (encontrada) return encontrada;
    }

    return null;
  }

  function obtenerNombreArea(id) {
    return obtenerArea(id)?.nombre || id;
  }

  function obtenerNombreSector(id) {
    return obtenerSector(id)?.nombre || id;
  }

  function obtenerNombreAptitud(id) {
    return obtenerAptitud(id)?.nombre || id;
  }

  function obtenerNodosPorAptitud(idAptitud) {
    return (DATOS?.nodos_conocimiento || []).filter(
      nodo => (nodo.id_aptitudes || []).includes(idAptitud)
    );
  }

  function obtenerNodosPorSector(idSector) {
    return (DATOS?.nodos_conocimiento || []).filter(
      nodo => (nodo.id_sectores || []).includes(idSector)
    );
  }

  function obtenerNodosPorArea(idArea) {
    return (DATOS?.nodos_conocimiento || []).filter(
      nodo => (nodo.id_areas || []).includes(idArea)
    );
  }

  function categoriaAptitudDeId(idAptitud) {
    if (!DATOS?.aptitudes) return '';

    for (const [categoria, lista] of Object.entries(DATOS.aptitudes)) {
      if ((lista || []).some(a => a.id === idAptitud)) {
        return categoria;
      }
    }

    return '';
  }

  function buscar(query) {
    const q = normalizar(query).trim();

    const resultado = {
      areas_hr: [],
      sectores: [],
      aptitudes: [],
      nodos: []
    };

    if (!q || !DATOS) return resultado;

    (DATOS.areas_hr || []).forEach(area => {
      if (coincide(area.nombre, q)) {
        agregarSinDuplicar(resultado.areas_hr, area);
      }
    });

    (DATOS.sectores || []).forEach(sector => {
      if (coincide(sector.nombre, q)) {
        agregarSinDuplicar(resultado.sectores, sector);
      }
    });

    for (const lista of Object.values(DATOS.aptitudes || {})) {
      (lista || []).forEach(aptitud => {
        if (coincide(aptitud.nombre, q)) {
          agregarSinDuplicar(resultado.aptitudes, aptitud);
        }
      });
    }

    (DATOS.nodos_conocimiento || []).forEach(nodo => {
      const sectores = (nodo.id_sectores || []).map(obtenerNombreSector);
      const aptitudes = (nodo.id_aptitudes || []).map(obtenerNombreAptitud);
      const areas = (nodo.id_areas || []).map(obtenerNombreArea);

      const encontrado =
        coincide(nodo.titulo, q) ||
        coincide(nodo.descripcion, q) ||
        coincide(nodo.entidades, q) ||
        coincide(nodo.periodo, q) ||
        coincide(nodo.tipo, q) ||
        coincide(nodo.palabras_clave, q) ||
        coincide(sectores, q) ||
        coincide(aptitudes, q) ||
        coincide(areas, q);

      if (encontrado) {
        agregarSinDuplicar(resultado.nodos, nodo);
      }
    });

    return resultado;
  }

  function nodoArbol(content, children = [], opciones = {}) {
    const nodo = {
      content: escaparHTML(content),
      children: children || []
    };

    if (opciones.fold !== undefined) {
      nodo.payload = {
        ...(opciones.payload || {}),
        fold: opciones.fold
      };
    } else if (opciones.payload) {
      nodo.payload = opciones.payload;
    }

    return nodo;
  }

  function construirRamaArea(area) {
    const hijos = obtenerNodosPorArea(area.id).map(nodo =>
      nodoArbol(nodo.titulo, [], {
        fold: 1,
        payload: {
          refId: nodo.id,
          tipo: 'conocimiento'
        }
      })
    );

    return nodoArbol(area.nombre, hijos, {
      fold: 1,
      payload: {
        refId: area.id,
        tipo: 'area'
      }
    });
  }

  function construirRamaAptitudes() {
    const nombres = {
      operacion: 'Operación & Logística',
      comercial: 'Comercial & Negocio',
      liderazgo: 'Liderazgo & Personas',
      tecnologia: 'Tecnología & IA',
      administracion: 'Administración & Gestión'
    };

    return Object.entries(DATOS.aptitudes || {}).map(([clave, lista]) => {
      const hijos = (lista || []).map(aptitud =>
        nodoArbol(aptitud.nombre, [], {
          fold: 1,
          payload: {
            refId: aptitud.id,
            tipo: 'aptitud'
          }
        })
      );

      return nodoArbol(
        nombres[clave] || clave,
        hijos,
        {
          fold: 1,
          payload: {
            tipo: 'categoria_aptitud',
            refId: clave
          }
        }
      );
    });
  }

  function construirRamaSectores() {
    return (DATOS.sectores || []).map(sector =>
      nodoArbol(sector.nombre, [], {
        fold: 1,
        payload: {
          refId: sector.id,
          tipo: 'sector'
        }
      })
    );
  }

  function construirArbol(opciones = {}) {
    const perfil = DATOS?.perfil || {};
    const foco = opciones.foco || null;

    const ramaIdentidad = nodoArbol(
      perfil.identidad_profesional ||
        'Estabilizador operativo transversal',
      [
        nodoArbol(perfil.mision || '')
      ],
      {
        fold: 1,
        payload: { tipo: 'identidad' }
      }
    );

    const ramasAreas = (DATOS?.areas_hr || []).map(construirRamaArea);

    const ramaAreas = nodoArbol(
      'Áreas de Gestión',
      ramasAreas,
      {
        fold: 1,
        payload: { tipo: 'areas' }
      }
    );

    const ramasAptitudes = construirRamaAptitudes();

    const ramaAptitudes = nodoArbol(
      'Aptitudes Transversales',
      ramasAptitudes,
      {
        fold: 1,
        payload: { tipo: 'aptitudes' }
      }
    );

    const ramasSectores = construirRamaSectores();

    const ramaSectores = nodoArbol(
      'Sectores de Aplicación',
      ramasSectores,
      {
        fold: 1,
        payload: { tipo: 'sectores' }
      }
    );

    const raiz = nodoArbol(
      perfil.nombre || 'Miguel Otero Cabaleiro',
      [
        ramaIdentidad,
        ramaAreas,
        ramaAptitudes,
        ramaSectores
      ],
      {
        payload: { tipo: 'raiz' }
      }
    );

    if (foco) {
      abrirCamino(raiz, foco);
    }

    return raiz;
  }

  function textoNodo(nodo) {
    return normalizar(
      String(nodo?.content || '').replace(/<[^>]*>/g, '')
    );
  }

  function abrirCamino(raiz, foco) {
    const objetivo = normalizar(foco.texto || '');
    if (!objetivo) return false;

    function recorrer(nodo, ancestros) {
      if (textoNodo(nodo).includes(objetivo)) {
        ancestros.forEach(x => {
          x.payload = {
            ...(x.payload || {}),
            fold: 0
          };
        });

        if (nodo.children?.length) {
          nodo.payload = {
            ...(nodo.payload || {}),
            fold: 0
          };
        }

        return true;
      }

      for (const hijo of nodo.children || []) {
        if (recorrer(hijo, [...ancestros, nodo])) {
          return true;
        }
      }

      return false;
    }

    return recorrer(raiz, []);
  }

  function renderArbol(opciones = {}) {
    if (!window.markmap?.Markmap || !DATOS) return;

    const svg = document.getElementById('mapa');
    if (!svg) return;

    svg.innerHTML = '';

    const arbol = construirArbol(opciones);

    markmapInstancia = window.markmap.Markmap.create(
      '#mapa',
      {
        autoFit: true,
        initialExpandLevel: NIVEL_ARBOL_BASE,
        duration: DURACION_ANIMACION,
        maxWidth: 260,
        spacingHorizontal: 55,
        spacingVertical: 5,
        zoom: true,
        pan: true
      },
      arbol
    );

    if (opciones.foco?.texto) {
      setTimeout(
        () => resaltarNodo(opciones.foco.texto),
        DURACION_ANIMACION + 80
      );
    }
  }

  function resaltarNodo(textoBuscado) {
    const objetivo = normalizar(textoBuscado);
    const nodos = document.querySelectorAll(
      '#mapa .markmap-node'
    );

    let encontrado = null;

    nodos.forEach(nodo => {
      nodo.classList.remove('nodo-activo');

      const texto = normalizar(
        nodo.querySelector('text')?.textContent || ''
      );

      if (!encontrado && texto.includes(objetivo)) {
        encontrado = nodo;
      }
    });

    if (!encontrado) return false;

    encontrado.classList.add('nodo-activo');

    try {
      encontrado.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    } catch (_) {}

    return true;
  }

  function mostrarArbolConFoco(texto) {
    activarVistaArbol();

    renderArbol({
      foco: {
        texto
      }
    });
  }

  function obtenerElementosVista() {
    return {
      lateral: document.querySelector('.lateral'),
      zonaArbol: document.querySelector('.zona-arbol'),
      contexto: document.getElementById('contexto'),
      menu: document.getElementById('menu')
    };
  }

  function activarVistaContenido() {
    const { lateral, zonaArbol } = obtenerElementosVista();

    if (!lateral || !zonaArbol) return;

    zonaArbol.style.display = 'none';

    lateral.style.width = '100%';
    lateral.style.minWidth = '0';
    lateral.style.maxWidth = 'none';

    document.body.classList.remove('vista-arbol');
    document.body.classList.add('vista-contenido');
  }

  function activarVistaArbol() {
    const { lateral, zonaArbol } = obtenerElementosVista();

    if (!lateral || !zonaArbol) return;

    zonaArbol.style.display = 'flex';

    document.body.classList.remove('vista-contenido');
    document.body.classList.add('vista-arbol');

    if (window.innerWidth > 1024) {
      lateral.style.width = '';
      lateral.style.minWidth = '';
      lateral.style.maxWidth = '';
    }
  }

  function activarMenu(id) {
    document.querySelectorAll('.menu-btn').forEach(btn => {
      btn.classList.toggle(
        'activo',
        btn.dataset.id === id
      );
    });
  }

  function mostrarHTML(html) {
    const contexto = document.getElementById('contexto');
    if (contexto) contexto.innerHTML = html;
  }

  function mostrarMensaje(texto) {
    mostrarHTML(
      `<div class="contexto-vacio">${escaparHTML(texto)}</div>`
    );
  }

  function renderBotonArbol(texto, id = '') {
    return `
      <button
        type="button"
        class="btn-herramienta btn-ver-arbol"
        data-foco="${escaparHTML(texto)}"
        data-ref-id="${escaparHTML(id)}">
        Ver en árbol
      </button>
    `;
  }

  function renderTarjetaNodo(nodo) {
    const sectores = (nodo.id_sectores || [])
      .map(obtenerNombreSector)
      .join(', ');

    const aptitudes = (nodo.id_aptitudes || [])
      .map(obtenerNombreAptitud)
      .join(', ');

    const areas = (nodo.id_areas || [])
      .map(obtenerNombreArea)
      .join(', ');

    const entidades = (nodo.entidades || []).join(', ');
    const keywords = (nodo.palabras_clave || []).join(', ');

    const tipo = normalizar(nodo.tipo);

    let badge = '#FF9900';

    if (tipo === 'experiencia') badge = '#007185';
    if (tipo === 'formacion') badge = '#2e7d32';
    if (tipo === 'capacitacion') badge = '#d32f2f';
    if (tipo === 'evidencia') badge = '#6a1b9a';

    let html = `
      <article class="item"
        style="border-left:4px solid ${badge};">

        <div style="
          display:flex;
          justify-content:space-between;
          gap:8px;
          align-items:flex-start;
          margin-bottom:5px;">

          <b>${escaparHTML(nodo.titulo)}</b>

          <span style="
            font-size:9px;
            background:${badge};
            color:#fff;
            padding:3px 6px;
            border-radius:3px;
            font-weight:700;
            white-space:nowrap;">

            ${escaparHTML(
              (nodo.tipo || 'Nodo').toUpperCase()
            )}

          </span>
        </div>
    `;

    if (nodo.periodo) {
      html += `
        <div style="
          font-size:11px;
          color:#565959;
          font-weight:600;
          margin-bottom:6px;">

          ${escaparHTML(nodo.periodo)}

        </div>
      `;
    }

    if (nodo.descripcion) {
      html += `
        <div style="
          color:#232F3E;
          line-height:1.5;
          margin-bottom:7px;">

          ${escaparHTML(nodo.descripcion)}

        </div>
      `;
    }

    if (entidades) {
      html += `
        <div class="ctx-label">
          Entidades / Empresas
        </div>

        <div>${escaparHTML(entidades)}</div>
      `;
    }

    if (areas) {
      html += `
        <div class="ctx-label">
          Áreas relacionadas
        </div>

        <div>${escaparHTML(areas)}</div>
      `;
    }

    if (sectores) {
      html += `
        <div class="ctx-label">
          Sectores relacionados
        </div>

        <div>${escaparHTML(sectores)}</div>
      `;
    }

    if (aptitudes) {
      html += `
        <div class="ctx-label">
          Aptitudes demostradas
        </div>

        <div>${escaparHTML(aptitudes)}</div>
      `;
    }

    if (keywords) {
      html += `
        <div class="ctx-label">
          Palabras clave
        </div>

        <div style="
          font-style:italic;
          font-size:10px;
          color:#565959;">

          ${escaparHTML(keywords)}

        </div>
      `;
    }

    html += `
        <div style="margin-top:9px;">
          ${renderBotonArbol(
            nodo.titulo,
            nodo.id
          )}
        </div>

      </article>
    `;

    return html;
  }

  function mostrarContextoArea(area) {
    activarVistaContenido();

    const nodos = obtenerNodosPorArea(area.id);

    let html = `
      <div class="ctx-titulo">
        ${escaparHTML(area.nombre)}
      </div>

      <div class="ctx-desc">
        Experiencias, conocimientos y evidencias vinculadas
        a esta área profesional.
      </div>
    `;

    if (!nodos.length) {
      html += `
        <div class="contexto-vacio">
          No hay referencias detalladas asociadas todavía.
        </div>
      `;
    } else {
      html += `
        <div class="ctx-label">
          Referencias relacionadas · ${nodos.length}
        </div>
      `;

      nodos.forEach(nodo => {
        html += renderTarjetaNodo(nodo);
      });
    }

    mostrarHTML(html);
  }

  function descripcionAptitud(aptitud) {
    const evidencias = obtenerNodosPorAptitud(
      aptitud.id
    );

    if (!evidencias.length) {
      return 'Aptitud declarada en la base profesional, pendiente de asociación documental adicional.';
    }

    const tipos = [
      ...new Set(
        evidencias
          .map(n => n.tipo)
          .filter(Boolean)
      )
    ].join(', ');

    return `Capacidad demostrada mediante ${evidencias.length} referencia(s) de conocimiento (${tipos || 'experiencia y evidencia profesional'}), vinculadas directamente a la actividad desarrollada.`;
  }

  function renderTarjetaAptitud(aptitud) {
    const evidencias = obtenerNodosPorAptitud(
      aptitud.id
    );

    const categoria =
      categoriaAptitudDeId(aptitud.id);

    let html = `
      <article class="item">

        <div style="
          display:flex;
          justify-content:space-between;
          gap:8px;
          align-items:flex-start;">

          <b>${escaparHTML(aptitud.nombre)}</b>

          <span style="
            font-size:9px;
            color:#565959;
            text-transform:uppercase;">

            ${escaparHTML(categoria)}

          </span>
        </div>

        <div style="
          margin-top:6px;
          color:#232F3E;
          line-height:1.5;">

          ${escaparHTML(
            descripcionAptitud(aptitud)
          )}

        </div>

        <div class="ctx-label">
          Referencias sólidas · ${evidencias.length}
        </div>
    `;

    if (evidencias.length) {
      evidencias.forEach(nodo => {
        html += `
          <div style="
            padding:5px 0;
            border-top:1px solid #E3E6E6;">

            <b>${escaparHTML(nodo.titulo)}</b>

            ${
              nodo.periodo
                ? `<div style="
                    font-size:10px;
                    color:#565959;">
                    ${escaparHTML(nodo.periodo)}
                   </div>`
                : ''
            }

          </div>
        `;
      });
    } else {
      html += `
        <div style="
          font-size:11px;
          color:#565959;">

          Sin referencia de experiencia asociada
          en la base actual.

        </div>
      `;
    }

    html += `
        <div style="margin-top:9px;">
          ${renderBotonArbol(
            aptitud.nombre,
            aptitud.id
          )}
        </div>

      </article>
    `;

    return html;
  }

  function mostrarContextoAptitudes() {
    activarVistaContenido();

    let html = `
      <div class="ctx-titulo">
        Aptitudes
      </div>

      <div class="ctx-desc">
        Capacidades profesionales consultables y vinculadas
        a referencias concretas de experiencia y conocimiento.
      </div>
    `;

    for (
      const [categoria, lista]
      of Object.entries(DATOS.aptitudes || {})
    ) {
      html += `
        <div class="ctx-label">
          ${escaparHTML(categoria)}
        </div>
      `;

      (lista || []).forEach(aptitud => {
        html += renderTarjetaAptitud(
          aptitud
        );
      });
    }

    mostrarHTML(html);
  }

  function renderTarjetaSector(sector) {
    const nodos = obtenerNodosPorSector(
      sector.id
    );

    let html = `
      <article class="item">

        <b>${escaparHTML(sector.nombre)}</b>

        <div style="
          margin-top:6px;
          color:#565959;">

          ${nodos.length}
          referencia(s) profesional(es) asociada(s).

        </div>
    `;

    if (nodos.length) {
      html += `
        <div class="ctx-label">
          Referencias
        </div>

        <div>
          ${nodos.map(n => `
            <div style="
              padding:4px 0;
              border-top:1px solid #E3E6E6;">

              ${escaparHTML(n.titulo)}

            </div>
          `).join('')}
        </div>
      `;
    }

    html += `
        <div style="margin-top:9px;">
          ${renderBotonArbol(
            sector.nombre,
            sector.id
          )}
        </div>

      </article>
    `;

    return html;
  }

  function mostrarContextoSectores() {
    activarVistaContenido();

    let html = `
      <div class="ctx-titulo">
        Sectores
      </div>

      <div class="ctx-desc">
        Sectores en los que existe experiencia,
        aplicación o conocimiento relacionado.
      </div>
    `;

    (DATOS.sectores || []).forEach(sector => {
      html += renderTarjetaSector(
        sector
      );
    });

    mostrarHTML(html);
  }

  function mostrarContextoTodosNodos() {
    activarVistaContenido();

    const nodos =
      DATOS.nodos_conocimiento || [];

    let html = `
      <div class="ctx-titulo">
        Conocimiento
      </div>

      <div class="ctx-desc">
        Inventario consultable de experiencias,
        formación, capacitación y evidencias,
        con sus relaciones profesionales.
      </div>

      <div class="ctx-label">
        Referencias · ${nodos.length}
      </div>
    `;

    nodos.forEach(nodo => {
      html += renderTarjetaNodo(nodo);
    });

    mostrarHTML(html);
  }

  function renderResultadosBusqueda(
    resultado,
    query
  ) {
    const total =
      resultado.areas_hr.length +
      resultado.sectores.length +
      resultado.aptitudes.length +
      resultado.nodos.length;

    activarVistaContenido();

    if (!total) {
      mostrarMensaje(
        `Sin resultados para "${query}". Prueba con camión, IA, DOG, logística, carretillas, PEMP, ventas...`
      );

      return;
    }

    let html = `
      <div class="ctx-titulo">
        Resultados
      </div>

      <div class="ctx-desc">
        ${total}
        referencia(s) encontrada(s) para
        «${escaparHTML(query)}».
      </div>
    `;

    if (resultado.areas_hr.length) {
      html += `
        <div class="ctx-label">
          Áreas
        </div>
      `;

      resultado.areas_hr.forEach(area => {
        html += `
          <div class="item">
            <b>${escaparHTML(area.nombre)}</b>

            <div style="margin-top:7px;">
              ${renderBotonArbol(
                area.nombre,
                area.id
              )}
            </div>
          </div>
        `;
      });
    }

    if (resultado.aptitudes.length) {
      html += `
        <div class="ctx-label">
          Aptitudes
        </div>
      `;

      resultado.aptitudes.forEach(aptitud => {
        html += renderTarjetaAptitud(
          aptitud
        );
      });
    }

    if (resultado.sectores.length) {
      html += `
        <div class="ctx-label">
          Sectores
        </div>
      `;

      resultado.sectores.forEach(sector => {
        html += renderTarjetaSector(
          sector
        );
      });
    }

    if (resultado.nodos.length) {
      html += `
        <div class="ctx-label">
          Conocimiento
        </div>
      `;

      resultado.nodos.forEach(nodo => {
        html += renderTarjetaNodo(
          nodo
        );
      });
    }

    mostrarHTML(html);
  }

  function conectarBuscador() {
    const input =
      document.getElementById('buscador');

    if (!input) return;

    input.addEventListener(
      'input',
      evento => {
        const query =
          evento.target.value.trim();

        if (!query) {
          activarVistaContenido();

          mostrarMensaje(
            'Selecciona una categoría o escribe una búsqueda.'
          );

          return;
        }

        renderResultadosBusqueda(
          buscar(query),
          query
        );
      }
    );
  }

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
      tipo: 'seccion'
    },
    {
      id: 'seccion_sectores',
      etiqueta: 'Sectores',
      tipo: 'seccion'
    },
    {
      id: 'seccion_nodos',
      etiqueta: 'Conocimiento',
      tipo: 'seccion'
    },
    {
      id: 'seccion_arbol',
      etiqueta: 'Árbol',
      tipo: 'arbol'
    }
  ];

  function renderMenu() {
    const contenedor =
      document.getElementById('menu');

    if (!contenedor) return;

    contenedor.innerHTML =
      MENU.map(item => `
        <button
          type="button"
          class="menu-btn"
          data-id="${escaparHTML(item.id)}"
          data-tipo="${escaparHTML(item.tipo)}">

          ${escaparHTML(item.etiqueta)}

        </button>
      `).join('');

    contenedor
      .querySelectorAll('.menu-btn')
      .forEach(btn => {
        btn.addEventListener(
          'click',
          () => {
            activarMenu(btn.dataset.id);

            navegarMenu(
              btn.dataset.id,
              btn.dataset.tipo
            );
          }
        );
      });
  }

  function navegarMenu(id, tipo) {
    if (tipo === 'arbol') {
      mostrarVistaArbol();
      return;
    }

    if (tipo === 'area') {
      const area = obtenerArea(id);

      if (area) {
        mostrarContextoArea(area);
      }

      return;
    }

    if (id === 'seccion_aptitudes') {
      mostrarContextoAptitudes();
      return;
    }

    if (id === 'seccion_sectores') {
      mostrarContextoSectores();
      return;
    }

    if (id === 'seccion_nodos') {
      mostrarContextoTodosNodos();
    }
  }

  function mostrarVistaArbol() {
    activarVistaArbol();

    renderArbol({
      nivel: NIVEL_ARBOL_BASE
    });

    mostrarHTML(`
      <div class="contexto-vacio">

        Árbol profesional.

        <br><br>

        Estado inicial:
        4 ramas principales contraídas.

        <br><br>

        Pulsa un nodo para ampliar
        su rama.

      </div>
    `);
  }

  function conectarBotonesArbol() {
    const expandir =
      document.getElementById(
        'btn-expandir'
      );

    const contraer =
      document.getElementById(
        'btn-contraer'
      );

    const limpiar =
      document.getElementById(
        'btn-limpiar'
      );

    if (expandir) {
      expandir.addEventListener(
        'click',
        () => {
          activarVistaArbol();

          renderArbol({
            nivel: 99
          });
        }
      );
    }

    if (contraer) {
      contraer.addEventListener(
        'click',
        () => {
          activarVistaArbol();

          renderArbol({
            nivel: NIVEL_ARBOL_BASE
          });
        }
      );
    }

    if (limpiar) {
      limpiar.addEventListener(
        'click',
        restablecerVista
      );
    }
  }

  function restablecerVista() {
    const buscador =
      document.getElementById(
        'buscador'
      );

    if (buscador) {
      buscador.value = '';
    }

    activarMenu(
      'seccion_arbol'
    );

    mostrarVistaArbol();
  }

  function conectarReferenciasArbol() {
    document.addEventListener(
      'click',
      evento => {
        const boton =
          evento.target.closest(
            '.btn-ver-arbol'
          );

        if (!boton) return;

        const foco =
          boton.dataset.foco || '';

        if (!foco) return;

        activarMenu(
          'seccion_arbol'
        );

        mostrarArbolConFoco(
          foco
        );
      }
    );
  }

  function conectarInteraccionArbol() {
    const mapa =
      document.getElementById(
        'mapa'
      );

    if (!mapa) return;

    mapa.addEventListener(
      'click',
      evento => {
        const nodo =
          evento.target.closest(
            '.markmap-node'
          );

        if (!nodo) return;

        const texto =
          nodo
            .querySelector('text')
            ?.textContent
            ?.trim();

        if (!texto) return;

        setTimeout(
          () => resaltarNodo(texto),
          DURACION_ANIMACION + 20
        );
      }
    );
  }

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
          magnitudes.anos_experiencia || 35
        )}+`;
    }

    if (hab) {
      hab.textContent =
        `${Number(
          magnitudes.habilidades || 20
        )}+`;
    }

    const bloqueMagnitudes =
      document.querySelector(
        '.cabecera-magnitudes'
      );

    if (bloqueMagnitudes) {
      const magnitudesDOM =
        bloqueMagnitudes.querySelectorAll(
          '.magnitud'
        );

      if (magnitudesDOM[0]) {
        const etiqueta =
          magnitudesDOM[0]
            .querySelector('span');

        if (etiqueta) {
          etiqueta.textContent =
            'años exp';
        }
      }

      if (magnitudesDOM[1]) {
        const etiqueta =
          magnitudesDOM[1]
            .querySelector('span');

        if (etiqueta) {
          etiqueta.textContent =
            'habilidades';
        }
      }

      if (magnitudesDOM[2]) {
        magnitudesDOM[2].style.display =
          'none';
      }
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

      conectarReferenciasArbol();

      conectarInteraccionArbol();

      activarVistaContenido();

      mostrarHTML(`
        <div class="contexto-vacio">

          Selecciona una categoría
          o utiliza el buscador para
          explorar el mapa profesional.

        </div>
      `);

      console.log(
        '✓ Plataforma cargada. knowledge-base.json es la fuente única de verdad.'
      );

    } catch (error) {
      console.error(
        'Error cargando knowledge-base.json:',
        error
      );

      const contexto =
        document.getElementById(
          'contexto'
        );

      if (contexto) {
        contexto.innerHTML = `
          <div class="contexto-vacio">

            No se pudo cargar la base
            de conocimiento.

            Comprueba que
            <b>knowledge-base.json</b>
            está en la raíz del repositorio.

          </div>
        `;
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.MiguelMapa = {
      buscar,
      construirArbol,
      renderArbol,
      mostrarVistaArbol,
      mostrarContextoAptitudes,
      mostrarContextoSectores,
      mostrarContextoTodosNodos,
      restablecerVista
    };
  }

  if (
    typeof module !== 'undefined' &&
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
