/* ============================================================
   app.js — Lógica de la Plataforma de Conocimiento Profesional
   Miguel Otero Cabaleiro — Estabilizador Operativo de Valor Transversal
   Lee exclusivamente de knowledge-base.json (Única fuente de verdad).
   Sin frameworks, compatible con GitHub Pages.
   ============================================================ */

/* ---------- 1. UTILIDADES DE TEXTO Y BÚSQUEDA ---------- */

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* Coincide si la búsqueda empieza una palabra o término completo.
   Garantiza máxima precisión sin falsos positivos. */
function coincide(campo, queryNorm) {
  if (!campo || !queryNorm) return false;
  const patron = new RegExp('(^|[^\\p{L}\\p{N}])' + escaparRegex(queryNorm), 'u');
  if (Array.isArray(campo)) {
    return campo.some(item => patron.test(normalizar(item)));
  }
  return patron.test(normalizar(campo));
}

function agregarSinDuplicar(lista, item) {
  if (!lista.some(x => x.id === item.id)) lista.push(item);
}

/* Mapeos auxiliares de IDs a Nombres */
function obtenerNombreSector(datos, idSector) {
  const sec = datos.sectores ? datos.sectores.find(s => s.id === idSector) : null;
  return sec ? sec.nombre : idSector;
}

function obtenerNombreAptitud(datos, idAptitud) {
  if (!datos.aptitudes) return idAptitud;
  for (const cat in datos.aptitudes) {
    const apt = datos.aptitudes[cat].find(a => a.id === idAptitud);
    if (apt) return apt.nombre;
  }
  return idAptitud;
}

function obtenerNombreArea(datos, idArea) {
  const area = datos.areas_hr ? datos.areas_hr.find(a => a.id === idArea) : null;
  return area ? area.nombre : idArea;
}

/* ---------- 2. MOTOR DE BÚSQUEDA MULTICRITERIO ---------- */

function buscar(query, datos) {
  const q = normalizar(query).trim();
  const vacio = {
    areas_hr: [],
    sectores: [],
    aptitudes: [],
    nodos: []
  };
  if (!q) return vacio;

  const r = {
    areas_hr: [],
    sectores: [],
    aptitudes: [],
    nodos: []
  };

  // 1. Áreas RRHH
  if (Array.isArray(datos.areas_hr)) {
    datos.areas_hr.forEach(area => {
      if (coincide(area.nombre, q)) {
        agregarSinDuplicar(r.areas_hr, area);
      }
    });
  }

  // 2. Sectores
  if (Array.isArray(datos.sectores)) {
    datos.sectores.forEach(sec => {
      if (coincide(sec.nombre, q)) {
        agregarSinDuplicar(r.sectores, sec);
      }
    });
  }

  // 3. Aptitudes
  if (datos.aptitudes) {
    for (const cat in datos.aptitudes) {
      datos.aptitudes[cat].forEach(apt => {
        if (coincide(apt.nombre, q)) {
          agregarSinDuplicar(r.aptitudes, apt);
        }
      });
    }
  }

  // 4. Nodos de Conocimiento (Experiencias, Formación, Licencias, Evidencias)
  if (Array.isArray(datos.nodos_conocimiento)) {
    datos.nodos_conocimiento.forEach(nodo => {
      const nombresSectores = (nodo.id_sectores || []).map(sId => obtenerNombreSector(datos, sId));
      const nombresAptitudes = (nodo.id_aptitudes || []).map(aId => obtenerNombreAptitud(datos, aId));
      const nombresAreas = (nodo.id_areas || []).map(arId => obtenerNombreArea(datos, arId));

      const coincideNodo = coincide(nodo.titulo, q) ||
                           coincide(nodo.descripcion, q) ||
                           coincide(nodo.entidades, q) ||
                           coincide(nodo.periodo, q) ||
                           coincide(nodo.tipo, q) ||
                           coincide(nodo.palabras_clave, q) ||
                           coincide(nombresSectores, q) ||
                           coincide(nombresAptitudes, q) ||
                           coincide(nombresAreas, q);

      if (coincideNodo) {
        agregarSinDuplicar(r.nodos, nodo);
      }
    });
  }

  return r;
}

/* ---------- 3. CONSTRUCCIÓN DEL ÁRBOL INTERACTIVO ---------- */

function construirArbol(datos) {
  const perfil = datos.perfil || {};
  const areas = datos.areas_hr || [];
  const nodos = datos.nodos_conocimiento || [];

  const ramaArea = (area) => {
    const nodosDelArea = nodos.filter(n => (n.id_areas || []).includes(area.id));
    const hijosNodos = nodosDelArea.map(nodo => ({ content: nodo.titulo }));
    return { content: area.nombre, children: hijosNodos };
  };

  const ramaAptitudes = () => {
    if (!datos.aptitudes) return [];
    const categorias = [
      { key: 'operacion', nombre: 'Operación & Logística' },
      { key: 'comercial', nombre: 'Comercial & Negocio' },
      { key: 'liderazgo', nombre: 'Liderazgo & Personas' },
      { key: 'tecnologia', nombre: 'Tecnología & IA' },
      { key: 'administracion', nombre: 'Administración & Gestión' }
    ];
    return categorias.map(cat => ({
      content: cat.nombre,
      children: (datos.aptitudes[cat.key] || []).map(a => ({ content: a.nombre }))
    }));
  };

  const ramaSectores = () => {
    return (datos.sectores || []).map(s => ({ content: s.nombre }));
  };

  return {
    content: perfil.nombre || 'Miguel Otero Cabaleiro',
    children: [
      {
        content: perfil.identidad_profesional || 'ESTABILIZADOR OPERATIVO DE VALOR TRANSVERSAL',
        children: [{ content: perfil.mision || '' }]
      },
      {
        content: 'Áreas de Gestión (RRHH)',
        children: areas.map(a => ramaArea(a))
      },
      {
        content: 'Aptitudes Transversales',
        children: ramaAptitudes()
      },
      {
        content: 'Sectores de Aplicación (20+)',
        children: ramaSectores()
      }
    ]
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizar, coincide, buscar, construirArbol };
}

/* ============================================================
   LÓGICA DE INTERFAZ Y NAVEGADOR
   ============================================================ */

if (typeof window !== 'undefined') {

  let DATOS = null;
  let markmapInstancia = null;

  const DURACION_ANIMACION = 300;

  const MENU = [
    { id: 'hr_ope', etiqueta: 'Operaciones', tipo: 'area' },
    { id: 'hr_com', etiqueta: 'Comercial', tipo: 'area' },
    { id: 'hr_ges', etiqueta: 'Gestión y Org.', tipo: 'area' },
    { id: 'hr_per', etiqueta: 'Personas', tipo: 'area' },
    { id: 'hr_tec', etiqueta: 'Tecnología', tipo: 'area' },
    { id: 'seccion_aptitudes', etiqueta: 'Aptitudes', tipo: 'seccion' },
    { id: 'seccion_sectores', etiqueta: 'Sectores', tipo: 'seccion' },
    { id: 'seccion_nodos', etiqueta: 'Conocimiento', tipo: 'seccion' }
  ];

  async function iniciar() {
    try {
      const resp = await fetch('./knowledge-base.json');
      DATOS = await resp.json();
      actualizarMagnitudesCabecera();
      renderMenu();
      renderArbol(1);
      conectarBotones();
      conectarBuscador();
      console.log('✓ Plataforma cargada correctamente. Base de conocimiento sincronizada.');
    } catch (err) {
      console.error('Error cargando knowledge-base.json:', err);
      document.getElementById('contexto').innerHTML =
        '<div class="contexto-vacio">No se pudo cargar knowledge-base.json. Comprueba que el archivo existe en la raíz del repositorio.</div>';
    }
  }

  function actualizarMagnitudesCabecera() {
    if (!DATOS || !DATOS.magnitudes) return;
    
    const elemExp = document.getElementById('m-exp');
    const elemSec = document.getElementById('m-sec');
    const elemEmp = document.getElementById('m-emp');

    if (elemExp) elemExp.textContent = (DATOS.magnitudes.anos_experiencia || 35) + '+';
    if (elemSec) elemSec.textContent = (DATOS.magnitudes.sectores || 20) + '+';
    if (elemEmp) elemEmp.textContent = (DATOS.magnitudes.formaciones || DATOS.magnitudes.empresas || 30) + '+';
  }

  function renderArbol(nivel) {
    if (!window.markmap || !DATOS) return;
    const { Markmap } = window.markmap;
    document.getElementById('mapa').innerHTML = '';
    const arbol = construirArbol(DATOS);
    markmapInstancia = Markmap.create('#mapa', {
      autoFit: true,
      initialExpandLevel: nivel,
      duration: DURACION_ANIMACION,
      maxWidth: 280,
      zoom: true,
      pan: true
    }, arbol);
  }

  function irANodo(textoBuscado) {
    const nodos = document.querySelectorAll('#mapa .markmap-node');
    let encontrado = null;
    nodos.forEach(n => {
      n.classList.remove('nodo-activo');
      const texto = n.querySelector('text')?.textContent || '';
      if (!encontrado && texto.toLowerCase().includes(textoBuscado.toLowerCase())) {
        encontrado = n;
      }
    });
    if (encontrado) {
      encontrado.classList.add('nodo-activo');
      encontrado.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
    return !!encontrado;
  }

  function renderMenu() {
    const cont = document.getElementById('menu');
    if (!cont) return;
    cont.innerHTML = MENU.map(m => `<button class="menu-btn" data-id="${m.id}" data-tipo="${m.tipo}">${m.etiqueta}</button>`).join('');
    cont.querySelectorAll('.menu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        cont.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('activo'));
        btn.classList.add('activo');
        irASeccion(btn.dataset.id, btn.dataset.tipo);
      });
    });
  }

  function irASeccion(id, tipo) {
    renderArbol(99);
    setTimeout(() => {
      if (tipo === 'area') {
        const area = (DATOS.areas_hr || []).find(a => a.id === id);
        if (area) {
          irANodo(area.nombre);
          mostrarContextoArea(area);
        }
      } else if (id === 'seccion_aptitudes') {
        irANodo('Aptitudes Transversales');
        mostrarContextoAptitudes();
      } else if (id === 'seccion_sectores') {
        irANodo('Sectores de Aplicación');
        mostrarContextoSectores();
      } else if (id === 'seccion_nodos') {
        irANodo('Áreas de Gestión (RRHH)');
        mostrarContextoTodosNodos();
      }
    }, DURACION_ANIMACION + 50);
  }

  function mostrarHTML(html) {
    const c = document.getElementById('contexto');
    if (c) c.innerHTML = html;
  }

  /* Renders de tarjetas formateadas por categoría */
  function renderTarjetaNodo(nodo) {
    const sectores = (nodo.id_sectores || []).map(s => obtenerNombreSector(DATOS, s)).join(', ');
    const aptitudes = (nodo.id_aptitudes || []).map(a => obtenerNombreAptitud(DATOS, a)).join(', ');
    const areas = (nodo.id_areas || []).map(ar => obtenerNombreArea(DATOS, ar)).join(', ');
    const entidades = (nodo.entidades || []).join(', ');
    const kw = (nodo.palabras_clave || []).join(', ');

    let badgeColor = '#FF9900';
    let badgeText = (nodo.tipo || 'Nodo').toUpperCase();

    if (nodo.tipo === 'experiencia') badgeColor = '#007185';
    if (nodo.tipo === 'formacion') badgeColor = '#2e7d32';
    if (nodo.tipo === 'capacitacion') badgeColor = '#d32f2f';
    if (nodo.tipo === 'evidencia') badgeColor = '#6a1b9a';

    let html = `<div class="item" style="border-left: 4px solid ${badgeColor};">`;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">`;
    html += `<b>${nodo.titulo}</b>`;
    html += `<span style="font-size:9px; background:${badgeColor}; color:#fff; padding:2px 6px; border-radius:3px; font-weight:700;">${badgeText}</span>`;
    html += `</div>`;
    html += `<div style="font-size:11px; color:#565959; font-weight:600; margin-bottom:6px;">Periodo: ${nodo.periodo}</div>`;
    html += `<div style="margin-top:4px; color:#232F3E; line-height:1.4;">${nodo.descripcion}</div>`;
    
    if (entidades) html += `<div class="ctx-label">Entidades / Empresas</div><div>${entidades}</div>`;
    if (areas) html += `<div class="ctx-label">Áreas RRHH</div><div>${areas}</div>`;
    if (sectores) html += `<div class="ctx-label">Sectores Directos</div><div>${sectores}</div>`;
    if (aptitudes) html += `<div class="ctx-label">Aptitudes Clave</div><div>${aptitudes}</div>`;
    if (kw) html += `<div class="ctx-label">Palabras Clave ATS</div><div style="font-style:italic; font-size:10px; color:#565959;">${kw}</div>`;
    
    html += `</div>`;
    return html;
  }

  function mostrarContextoArea(area) {
    let html = `<div class="ctx-titulo">${area.nombre}</div>`;
    html += `<div class="ctx-desc">Área de gestión estratégica y operativa.</div>`;
    const nodosDelArea = (DATOS.nodos_conocimiento || []).filter(n => (n.id_areas || []).includes(area.id));
    if (nodosDelArea.length) {
      html += `<div class="ctx-label">Nodos de Conocimiento Relacionados</div>`;
      nodosDelArea.forEach(n => {
        html += renderTarjetaNodo(n);
      });
    }
    mostrarHTML(html);
  }

  function mostrarContextoAptitudes() {
    let html = `<div class="ctx-titulo">Aptitudes Transversales</div>`;
    html += `<div class="ctx-desc">Capacidades operativas, comerciales, de liderazgo y tecnológicas.</div>`;
    if (DATOS.aptitudes) {
      for (const cat in DATOS.aptitudes) {
        const nombreCat = cat.toUpperCase();
        html += `<div class="ctx-label">${nombreCat}</div>`;
        DATOS.aptitudes[cat].forEach(a => {
          html += `<div class="item"><b>${a.nombre}</b></div>`;
        });
      }
    }
    mostrarHTML(html);
  }

  function mostrarContextoSectores() {
    let html = `<div class="ctx-titulo">Sectores de Aplicación (20+)</div>`;
    html += `<div class="ctx-desc">Ámbitos profesionales donde se aplica la capacidad transversal de estabilización.</div>`;
    if (DATOS.sectores) {
      DATOS.sectores.forEach(s => {
        html += `<div class="item"><b>${s.nombre}</b></div>`;
      });
    }
    mostrarHTML(html);
  }

  function mostrarContextoTodosNodos() {
    let html = `<div class="ctx-titulo">Nodos de Conocimiento (Base Completa)</div>`;
    html += `<div class="ctx-desc">Inventario completo de experiencias, formación reglada, licencias y evidencias registrales.</div>`;
    if (DATOS.nodos_conocimiento) {
      DATOS.nodos_conocimiento.forEach(n => {
        html += renderTarjetaNodo(n);
      });
    }
    mostrarHTML(html);
  }

  function conectarBuscador() {
    const inputBuscador = document.getElementById('buscador');
    if (!inputBuscador) return;
    inputBuscador.addEventListener('input', (e) => {
      const q = e.target.value;
      if (!q.trim()) {
        mostrarHTML('<div class="contexto-vacio">Selecciona una categoría o escribe una búsqueda</div>');
        return;
      }
      const r = buscar(q, DATOS);
      renderResultadosBusqueda(r);
    });
  }

  function renderResultadosBusqueda(r) {
    const total = r.areas_hr.length + r.sectores.length + r.aptitudes.length + r.nodos.length;
    if (total === 0) {
      mostrarHTML('<div class="contexto-vacio">Sin resultados para esa búsqueda. Intenta con palabras como "camión", "IA", "DOG", "carretillas" o "PEMP".</div>');
      return;
    }
    let html = '';

    if (r.areas_hr.length) {
      html += `<div class="ctx-label">Áreas RRHH</div>`;
      r.areas_hr.forEach(a => {
        html += `<div class="item"><b>${a.nombre}</b></div>`;
      });
    }

    if (r.sectores.length) {
      html += `<div class="ctx-label">Sectores</div>`;
      r.sectores.forEach(s => {
        html += `<div class="item"><b>${s.nombre}</b></div>`;
      });
    }

    if (r.aptitudes.length) {
      html += `<div class="ctx-label">Aptitudes</div>`;
      r.aptitudes.forEach(ap => {
        html += `<div class="item"><b>${ap.nombre}</b></div>`;
      });
    }

    if (r.nodos.length) {
      html += `<div class="ctx-label">Nodos de Conocimiento (${r.nodos.length})</div>`;
      r.nodos.forEach(n => {
        html += renderTarjetaNodo(n);
      });
    }

    mostrarHTML(html);
  }

  function conectarBotones() {
    const btnExpandir = document.getElementById('btn-expandir');
    const btnContraer = document.getElementById('btn-contraer');
    const btnLimpiar = document.getElementById('btn-limpiar');

    if (btnExpandir) btnExpandir.addEventListener('click', () => renderArbol(99));
    if (btnContraer) btnContraer.addEventListener('click', () => renderArbol(1));
    if (btnLimpiar) btnLimpiar.addEventListener('click', () => {
      const buscador = document.getElementById('buscador');
      if (buscador) buscador.value = '';
      document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('activo'));
      mostrarHTML('<div class="contexto-vacio">Selecciona una categoría o escribe una búsqueda</div>');
      renderArbol(1);
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
}
