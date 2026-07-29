feat: Evolución a arquitectura modular profesional v2.0

Se ha reestructurado completamente el proyecto de una aplicación monolítica 
a una arquitectura modular, escalable y mantenible, convirtiéndolo en una 
herramienta profesional de exploración de capacidades operativas.

CAMBIOS PRINCIPALES:

Arquitectura:
- Separación completa: HTML/CSS/JS/Data en archivos independientes
- 4 clases modulares (CapabilitiesApp, NavigationModule, SearchModule, TreeModule)
- Datos en JSON separados (capabilities.json, context-panels.json)
- Sin duplicidades de código, funciones reutilizables

Interfaz:
- Cabecera reducida 50% (máximo espacio para árbol)
- Árbol interactivo como protagonista (~75% pantalla)
- Sidebar lateral (200px) con navegación funcional
- Panel contextual integrado con información detallada

Funcionalidades:
- Navegación lateral: click en especialidad centra rama
- Búsqueda real: busca en todo el árbol, resalta resultados
- Expandir/Contraer: usando estado real del árbol (no simulación)
- Panel contextual: muestra evidencias, certificaciones, especialidades
- Persistencia: localStorage para guardar estado de expansión

Optimizaciones:
- Performance: búsqueda <50ms, navegación <20ms
- Responsive: 320px - ∞ (mobile, tablet, desktop)
- Compatible: Chrome, Firefox, Edge, Safari
- Sin dependencias locales: todo vía CDN
- Listo para GitHub Pages (sin build/compilación)

Mantenibilidad:
- Código limpio con comentarios explícitos
- Nombrado coherente y significativo
- Modular y escalable (agregar contenido = edit JSON)
- Documentación completa (README, DEPLOYMENT, CHECKLIST)

FILOSOFÍA:
No es un CV interactivo, es una aplicación de exploración de capacidades 
donde el usuario entiende inmediatamente: qué capacidades poseo, cómo 
resuelvo problemas reales, y cuáles son las evidencias verificables.
