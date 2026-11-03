/* ==========================================
   BASE DE DATOS EN LOCALSTORAGE (DISCO LOCAL)
   ========================================== */
function cargarDatos() {
    return {
        usuarios: JSON.parse(localStorage.getItem('eco_usuarios')) || [],
        clasificaciones: JSON.parse(localStorage.getItem('eco_clasificaciones')) || [],
        quizzes: JSON.parse(localStorage.getItem('eco_quizzes')) || [],
        manualidades: JSON.parse(localStorage.getItem('eco_manualidades')) || []
    };
}

function guardarDatos(datos) {
    localStorage.setItem('eco_usuarios', JSON.stringify(datos.usuarios));
    localStorage.setItem('eco_clasificaciones', JSON.stringify(datos.clasificaciones));
    localStorage.setItem('eco_quizzes', JSON.stringify(datos.quizzes));
    localStorage.setItem('eco_manualidades', JSON.stringify(datos.manualidades || []));
}

/* ==========================================
   VARIABLES GLOBALES
   ========================================== */
let usuarioActual = { nombre: '', documento: '', rol: '' };
let respuestasCorrectas = 0;
let preguntasRespondidas = 0;
let preguntaActual = 1;

const TOTAL_PREGUNTAS = 10;
const NOTA_MAXIMA = 5.0;
const PUNTOS_POR_PREGUNTA = NOTA_MAXIMA / TOTAL_PREGUNTAS;

// Definimos las respuestas correctas para poder "reconstruir" el quiz si ya fue resuelto
// Esto guarda: { "q1": índice de la opción correcta (0,1,2), "q2": ... }
const RESPUESTAS_CORRECTAS = {
    q1: 0, // Caneca Blanca
    q2: 1, // Residuos orgánicos
    q3: 2, // Peligrosos
    q4: 2, // Gris
    q5: 0, // Resolución 2184
    q6: 1, // Consumir menos
    q7: 1, // Blanca
    q8: 1, // Mezclar aprovechables con no aprovechables
    q9: 1, // Blanca (aprovechable)
    q10: 2 // Reducir el consumo de recursos
};

const EXPLICACIONES_QUIZ = {
    q1: 'Los residuos aprovechables limpios se depositan en la caneca blanca.',
    q2: 'Los restos de comida son orgánicos y pueden aprovecharse para hacer compost.',
    q3: 'Pilas y medicamentos pueden contaminar; llévalos a puntos de recolección especiales.',
    q4: 'La caneca gris corresponde a residuos no aprovechables en esta actividad.',
    q5: 'La Resolución 2184 de 2019 estableció el código de colores en Colombia.',
    q6: 'Reducir significa consumir con responsabilidad y generar menos residuos.',
    q7: 'Los envases de vidrio limpios son aprovechables y van en la caneca blanca.',
    q8: 'Si se mezclan, los residuos reciclables pueden contaminarse y perder su aprovechamiento.',
    q9: 'Un envase limpio y vacío puede reciclarse con los residuos aprovechables.',
    q10: 'Reciclar ayuda a ahorrar materias primas y disminuir la contaminación.'
};

/* ==========================================
   LOGIN CON VALIDACIÓN Y USUARIO ÚNICO
   ========================================== */
function iniciarSesion() {
    const nombreInput = document.getElementById('nombre').value.trim();
    const documentoInput = document.getElementById('documento').value.trim();

    if (nombreInput === '' || documentoInput === '') {
        alert('Por favor, completa todos los campos.');
        return;
    }

    let rolAsignado = 'Estudiante';
    if (nombreInput.toLowerCase() === 'profesor' && documentoInput === '11111111') {
        rolAsignado = 'Docente';
    } 
    else if (nombreInput.toLowerCase() === 'coordinador' && documentoInput === '00000000') {
        rolAsignado = 'Coordinador';
    }

    let datos = cargarDatos();
    const indiceUsuario = datos.usuarios.findIndex(u => u.documento === documentoInput);

    let nombreFinal = nombreInput;
    let mensajeBienvenida = '';

    if (indiceUsuario === -1) {
        // Usuario nuevo
        const nuevoUsuario = {
            nombre: nombreInput,
            documento: documentoInput,
            rol: rolAsignado,
            ultimoIngreso: new Date().toLocaleString(),
            totalIngresos: 1
        };
        datos.usuarios.push(nuevoUsuario);
        mensajeBienvenida = `👋 ¡Bienvenido/a, ${nombreInput}!\n\nTu cuenta ha sido registrada como ${rolAsignado}.`;
    } 
    else {
        // Usuario existente
        const usuarioExistente = datos.usuarios[indiceUsuario];
        
        if (usuarioExistente.nombre.toLowerCase() !== nombreInput.toLowerCase()) {
            alert(`⚠️ El documento ${documentoInput} ya está registrado a nombre de "${usuarioExistente.nombre}".\n\nSe ingresará con ese nombre.`);
        }
        
        nombreFinal = usuarioExistente.nombre;
        rolAsignado = usuarioExistente.rol;
        
        datos.usuarios[indiceUsuario].ultimoIngreso = new Date().toLocaleString();
        datos.usuarios[indiceUsuario].totalIngresos = (datos.usuarios[indiceUsuario].totalIngresos || 0) + 1;
        
        mensajeBienvenida = `👋 ¡Bienvenido/a de nuevo, ${nombreFinal}!`;
    }

    guardarDatos(datos);

    usuarioActual.nombre = nombreFinal;
    usuarioActual.documento = documentoInput;
    usuarioActual.rol = rolAsignado;

    if (indiceUsuario === -1) {
        alert(mensajeBienvenida);
    }

    document.getElementById('info-usuario').innerText = `👤 ${usuarioActual.nombre} (${usuarioActual.rol})`;
    document.getElementById('pantalla-login').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';

    // *** AQUÍ ESTÁ EL CAMBIO PRINCIPAL ***
    // En lugar de reiniciar siempre, verificamos si ya hizo el quiz
    cargarEstadoQuiz();
    configurarMenu();
}

function cerrarSesion() {
    usuarioActual = { nombre: '', documento: '', rol: '' };
    document.getElementById('nombre').value = '';
    document.getElementById('documento').value = '';
    document.getElementById('pantalla-login').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    document.querySelectorAll('.seccion').forEach(sec => sec.classList.remove('active'));
    document.getElementById('resultado').style.display = 'none';
}

/* ==========================================
   CARGAR ESTADO DEL QUIZ (NUEVA FUNCIÓN CLAVE)
   ========================================== */
function cargarEstadoQuiz() {
    // 1. Primero limpiamos el quiz por completo (por si acaso)
    reiniciarQuizVisual();

    // 2. Buscamos si este usuario ya tiene un quiz guardado
    let datos = cargarDatos();
    const quizExistente = datos.quizzes.find(q => q.documento === usuarioActual.documento);

    if (quizExistente) {
        // --- YA HIZO EL QUIZ: Reconstruir respuestas ---
        mostrarQuizResuelto(quizExistente);
    }
    // Si no existe, no hacemos nada: el quiz se ve en blanco para que lo resuelva.
}

function reiniciarQuizVisual() {
    respuestasCorrectas = 0;
    preguntasRespondidas = 0;
    preguntaActual = 1;
    respuestasUsuario = [];
    document.getElementById('resultado-quiz').style.display = 'none';
    document.getElementById('nota-final').innerText = '';
    document.getElementById('texto-resultado-quiz').innerText = 'Tu nota ha sido guardada. El docente podrá verla en su panel.';
    document.getElementById('quiz-interaccion').style.display = '';
    document.getElementById('quiz-feedback').hidden = true;
    document.getElementById('quiz-feedback').textContent = '';
    document.getElementById('quiz-siguiente').hidden = true;
    document.getElementById('quiz-siguiente').disabled = true;
    document.getElementById('quiz-siguiente').textContent = 'Siguiente pregunta';
    document.getElementById('quiz-progreso-texto').textContent = `Pregunta 1 de ${TOTAL_PREGUNTAS}`;
    document.getElementById('quiz-puntaje').textContent = `0.0 / ${NOTA_MAXIMA.toFixed(1)} puntos`;
    document.getElementById('quiz-progreso').setAttribute('aria-valuenow', '0');
    document.getElementById('quiz-progreso-barra').style.width = '0%';
    document.getElementById('quiz-mensaje').textContent = 'Tómate tu tiempo y piensa en el planeta.';
    
    for (let i = 1; i <= TOTAL_PREGUNTAS; i++) {
        const pregunta = document.getElementById('q' + i);
        if (!pregunta) continue;
        pregunta.classList.toggle('active', i === 1);
        
        const botones = pregunta.querySelectorAll('button');
        botones.forEach(boton => {
            boton.disabled = false;
            boton.classList.remove('correcta', 'incorrecta');
            boton.setAttribute('aria-pressed', 'false');
        });
    }
}

function mostrarQuizResuelto(quiz) {
    document.getElementById('quiz-interaccion').style.display = 'none';
    document.getElementById('nota-final').innerText = `Ya completaste el quiz: ${quiz.nota.toFixed(1)} / ${NOTA_MAXIMA.toFixed(1)}`;
    document.getElementById('texto-resultado-quiz').innerText = `Obtuviste ${quiz.porcentaje}% de aciertos. Tu resultado está guardado y no puedes volver a realizar este intento.`;
    document.getElementById('resultado-quiz').style.display = 'block';
}

/* ==========================================
   CONFIGURACIÓN DEL MENÚ
   ========================================== */
function configurarMenu() {
    const nav = document.getElementById('menu-navegacion');
    nav.innerHTML = '';
    document.querySelectorAll('.seccion').forEach(sec => sec.classList.remove('active'));

    if (usuarioActual.rol === 'Estudiante') {
        nav.innerHTML += `<button class="active" onclick="cambiarSeccion('informacion', this)">ℹ️ Información</button>`;
        nav.innerHTML += `<button onclick="cambiarSeccion('clasificacion', this)">🗑️ Clasificar</button>`;
        nav.innerHTML += `<button onclick="cambiarSeccion('manualidades', this)">🎨 Manualidades</button>`;
        nav.innerHTML += `<button onclick="cambiarSeccion('quiz', this)">📝 Quiz</button>`;
        nav.innerHTML += `<button onclick="cambiarSeccion('videos', this)">🎬 Videos</button>`;
        document.getElementById('informacion').classList.add('active');
    } 
      else if (usuarioActual.rol === 'Docente') {
        nav.innerHTML += `<button class="active" onclick="cambiarSeccion('panel-docente', this)">📊 Panel Docente</button>`;
        document.getElementById('panel-docente').classList.add('active');
        actualizarPanelDocente();
    } 
    else if (usuarioActual.rol === 'Coordinador') {
        nav.innerHTML += `<button class="active" onclick="cambiarSeccion('panel-coordinador', this)">📈 Panel Coordinador</button>`;
        document.getElementById('panel-coordinador').classList.add('active');
        actualizarPanelCoordinador();
    }
}

function cambiarSeccion(idSeccion, boton) {
    document.querySelectorAll('.seccion').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(idSeccion).classList.add('active');
    boton.classList.add('active');

    if (idSeccion === 'panel-docente') actualizarPanelDocente();
    if (idSeccion === 'panel-coordinador') actualizarPanelCoordinador();
}

/* ==========================================
   CLASIFICACIÓN
   ========================================== */
function mostrarInfoCaneca(color) {
    const informacionCanecas = {
        verde: {
            titulo: '♻ Caneca verde',
            descripcion: 'Para residuos orgánicos, como restos de comida y cáscaras de frutas.'
        },
        blanca: {
            titulo: '♻ Caneca blanca',
            descripcion: 'Para residuos aprovechables limpios y secos, como papel, plástico, vidrio y metal.'
        },
        gris: {
            titulo: '♻ Caneca gris',
            descripcion: 'Para residuos no aprovechables, como servilletas sucias y papeles contaminados.'
        },
        roja: {
            titulo: '♻ Caneca roja',
            descripcion: 'Para residuos peligrosos, infecciosos o especiales que representan un riesgo para la salud y el medio ambiente.'
        }
    };
    const informacion = informacionCanecas[color];
    if (!informacion) return;

    const dialogo = document.getElementById('caneca-dialogo');
    dialogo.classList.remove('caneca-dialogo-verde', 'caneca-dialogo-blanca', 'caneca-dialogo-gris', 'caneca-dialogo-roja');
    dialogo.classList.add(`caneca-dialogo-${color}`);
    document.getElementById('caneca-dialogo-titulo').textContent = informacion.titulo;
    document.getElementById('caneca-dialogo-texto').textContent = informacion.descripcion;
    dialogo.showModal();
}

function clasificar(residuo, colorCaneca, mensaje) {
    const resultadoDiv = document.getElementById('resultado');
    const titulo = document.getElementById('res-titulo');
    const mensajeP = document.getElementById('res-mensaje');

    let colorHex = '', colorFondo = '';
    if (colorCaneca === 'blanco') { colorHex = '#cccccc'; colorFondo = '#ffffff'; titulo.innerText = 'Caneca BLANCA (Aprovechables)'; }
    else if (colorCaneca === 'verde') { colorHex = '#2e7d32'; colorFondo = '#e8f5e9'; titulo.innerText = 'Caneca VERDE (Orgánicos)'; }
    else if (colorCaneca === 'rojo') { colorHex = '#c62828'; colorFondo = '#ffebee'; titulo.innerText = 'Caneca ROJA (Peligrosos)'; }
    else if (colorCaneca === 'gris') { colorHex = '#757575'; colorFondo = '#f5f5f5'; titulo.innerText = 'Caneca GRIS (No aprovechables)'; }

    resultadoDiv.style.display = 'block';
    resultadoDiv.style.borderLeftColor = colorHex;
    resultadoDiv.style.backgroundColor = colorFondo;
    titulo.style.color = colorHex;
    mensajeP.innerText = mensaje;

    let datos = cargarDatos();
    datos.clasificaciones.unshift({
        usuario: usuarioActual.nombre,
        documento: usuarioActual.documento,
        rol: usuarioActual.rol,
        residuo: residuo,
        caneca: titulo.innerText.split(' ')[1]
    });
    guardarDatos(datos);
}

function mostrarManualidad(tipo, boton) {
    const manualidades = {
        macetero: {
            titulo: 'Macetero con botella plástica',
            imagen: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Bottle_flower_pots.jpg/960px-Bottle_flower_pots.jpg',
            alt: 'Macetas decorativas hechas con botellas reutilizadas',
            fuente: 'https://commons.wikimedia.org/wiki/File:Bottle_flower_pots.jpg',
            materiales: ['Una botella plástica limpia', 'Tijeras', 'Tierra y una planta pequeña', 'Pintura o marcadores (opcional)'],
            pasos: ['Pide ayuda a una persona adulta para cortar la botella por la mitad.', 'Haz pequeños orificios en la base para que salga el exceso de agua.', 'Decora el recipiente y deja secar si usaste pintura.', 'Agrega tierra, planta una semilla o plántula y riégala con moderación.']
        },
        papel: {
            titulo: 'Papel reciclado artesanal',
            imagen: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Drying_handmade_paper.jpg/960px-Drying_handmade_paper.jpg',
            alt: 'Hojas de papel artesanal reciclado secándose',
            fuente: 'https://commons.wikimedia.org/wiki/File:Drying_handmade_paper.jpg',
            materiales: ['Hojas usadas sin plastificar', 'Agua', 'Un recipiente', 'Un colador o tela fina', 'Licuadora (con ayuda adulta)'],
            pasos: ['Rompe el papel en trozos pequeños y déjalo en agua varias horas.', 'Tritura la mezcla con ayuda adulta hasta formar una pulpa.', 'Extiende una capa fina de pulpa sobre el colador o la tela.', 'Presiona para retirar el agua y deja secar completamente antes de usar.']
        },
        portalapices: {
            titulo: 'Portalápices con envase reutilizado',
            imagen: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Dzhalil_pencil_holder_%282024-02-15%29_01.jpg/960px-Dzhalil_pencil_holder_%282024-02-15%29_01.jpg',
            alt: 'Portalápices hecho a mano para organizar lápices',
            fuente: 'https://commons.wikimedia.org/wiki/File:Dzhalil_pencil_holder_(2024-02-15)_01.jpg',
            materiales: ['Un envase plástico limpio y seco', 'Tijeras', 'Papel reutilizado o retazos de tela', 'Pegamento escolar'],
            pasos: ['Pide ayuda adulta para recortar el envase a la altura deseada.', 'Cubre los bordes cortados con cinta para que no queden filosos.', 'Forra el exterior con papel o tela reutilizada.', 'Decora y úsalo para guardar lápices y colores.']
        },
        huerto: {
            titulo: 'Mini huerto en envases',
            imagen: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/Biohuerto_de_Huanchac.jpg/960px-Biohuerto_de_Huanchac.jpg',
            alt: 'Huerto comunitario con plantas sembradas en recipientes',
            fuente: 'https://commons.wikimedia.org/wiki/File:Biohuerto_de_Huanchac.jpg',
            materiales: ['Envases limpios con drenaje', 'Tierra abonada', 'Semillas de hierbas o plantas pequeñas', 'Agua'],
            pasos: ['Asegúrate de que cada envase tenga orificios para drenar.', 'Llena el envase con tierra, dejando espacio arriba.', 'Coloca las semillas siguiendo las indicaciones del empaque y cúbrelas suavemente.', 'Riega sin encharcar y ubica el huerto donde reciba la luz adecuada.']
        },
        organizador: {
            titulo: 'Organizador escolar de cartón',
            imagen: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/USVI_IMG_5202_-_Minimalist_desk_with_colorful_pencils_in_a_cardboard_holder_a_cup_holding_pens_and_scissors_and_a_notebook_with_botanical_patterns_all_under_soft_light.jpg/960px-thumbnail.jpg',
            alt: 'Portalápices de cartón en un escritorio escolar organizado',
            fuente: 'https://commons.wikimedia.org/wiki/File:USVI_IMG_5202_-_Minimalist_desk_with_colorful_pencils_in_a_cardboard_holder_a_cup_holding_pens_and_scissors_and_a_notebook_with_botanical_patterns_all_under_soft_light.jpg',
            materiales: ['Una caja pequeña y limpia', 'Tubos de cartón', 'Pegamento escolar', 'Papel usado para decorar'],
            pasos: ['Acomoda los tubos dentro de la caja para decidir dónde irá cada útil.', 'Recorta los tubos a distintas alturas si hace falta.', 'Pégalos a la base y espera a que el pegamento seque.', 'Forra la caja con papel reutilizado y organiza tus útiles.']
        },
        arte: {
            titulo: 'Collage de materiales reutilizados',
            imagen: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Recycled_paper_collage.jpg/960px-Recycled_paper_collage.jpg',
            alt: 'Collage artístico creado con papel reciclado de varios colores',
            fuente: 'https://commons.wikimedia.org/wiki/File:Recycled_paper_collage.jpg',
            materiales: ['Cartón usado como base', 'Revistas o papeles usados', 'Retazos limpios de tela', 'Pegamento escolar y tijeras'],
            pasos: ['Elige un tema para tu collage, como la naturaleza o los animales.', 'Recorta formas e imágenes de los materiales reutilizados.', 'Organiza las piezas sobre el cartón antes de pegarlas.', 'Pega las piezas y deja secar el trabajo.']
        }
    };

    const manualidad = manualidades[tipo];
    if (!manualidad) return;

    const detalle = document.getElementById('detalle-manualidad');
    detalle.innerHTML = `<h3>${manualidad.titulo}</h3>
        <div class="craft-result-layout">
            <figure class="craft-result-figure">
                <img src="${manualidad.imagen}" alt="${manualidad.alt}" loading="lazy">
                <figcaption>Imagen ilustrativa · <a href="${manualidad.fuente}" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a></figcaption>
            </figure>
            <div class="craft-instructions">
                <h4>Materiales</h4>
                <ul>${manualidad.materiales.map(material => `<li>${material}</li>`).join('')}</ul>
                <h4>Pasos</h4>
                <ol>${manualidad.pasos.map(paso => `<li>${paso}</li>`).join('')}</ol>
            </div>
        </div>`;
    detalle.hidden = false;

    if (usuarioActual.rol === 'Estudiante') {
        const datos = cargarDatos();
        const fecha = new Date();
        datos.manualidades.unshift({
            usuario: usuarioActual.nombre,
            documento: usuarioActual.documento,
            rol: usuarioActual.rol,
            manualidad: manualidad.titulo,
            fecha: fecha.toLocaleString(),
            fechaISO: fecha.toISOString()
        });
        guardarDatos(datos);
    }

    document.querySelectorAll('.craft-btn').forEach(botonManualidad => {
        const seleccionado = botonManualidad === boton;
        botonManualidad.classList.toggle('selected', seleccionado);
        botonManualidad.setAttribute('aria-pressed', String(seleccionado));
    });
}

/* ==========================================
   QUIZ (Guarda respuestas detalladas)
   ========================================== */
// Guardamos temporalmente las respuestas del usuario para este intento
let respuestasUsuario = [];

function responder(idPregunta, boton, esCorrecta) {
    const numeroPregunta = Number(idPregunta.slice(1));
    if (numeroPregunta !== preguntaActual) return;

    const botones = document.getElementById(idPregunta).querySelectorAll('button');
    if (botones[0].disabled) return;

    // Identificamos el índice de la opción elegida
    let indiceElegido = 0;
    botones.forEach((b, i) => { if (b === boton) indiceElegido = i; });

    // Guardamos la respuesta en el arreglo temporal
    respuestasUsuario[numeroPregunta - 1] = indiceElegido;

    botones.forEach((opcion, indice) => {
        opcion.disabled = true;
        opcion.setAttribute('aria-pressed', String(opcion === boton));
        if (indice === RESPUESTAS_CORRECTAS[idPregunta]) opcion.classList.add('correcta');
    });

    if (esCorrecta) {
        boton.classList.add('correcta');
        respuestasCorrectas++;
    } else {
        boton.classList.add('incorrecta');
    }

    preguntasRespondidas = numeroPregunta;
    document.getElementById('quiz-puntaje').textContent = `${(respuestasCorrectas * PUNTOS_POR_PREGUNTA).toFixed(1)} / ${NOTA_MAXIMA.toFixed(1)} puntos`;
    document.getElementById('quiz-progreso').setAttribute('aria-valuenow', String(preguntasRespondidas));
    document.getElementById('quiz-progreso-barra').style.width = `${(preguntasRespondidas / TOTAL_PREGUNTAS) * 100}%`;

    const respuestaCorrecta = botones[RESPUESTAS_CORRECTAS[idPregunta]].textContent.trim();
    const feedback = document.getElementById('quiz-feedback');
    feedback.classList.toggle('is-correct', esCorrecta);
    feedback.classList.toggle('is-incorrect', !esCorrecta);
    feedback.textContent = esCorrecta
        ? `¡Correcto! ${EXPLICACIONES_QUIZ[idPregunta]}`
        : `La respuesta correcta es: ${respuestaCorrecta}. ${EXPLICACIONES_QUIZ[idPregunta]}`;
    feedback.hidden = false;

    const botonSiguiente = document.getElementById('quiz-siguiente');
    if (numeroPregunta === TOTAL_PREGUNTAS) {
        botonSiguiente.textContent = 'Presentar el quiz';
        botonSiguiente.disabled = false;
        botonSiguiente.hidden = false;
    } else {
        botonSiguiente.textContent = 'Siguiente pregunta';
        botonSiguiente.disabled = false;
        botonSiguiente.hidden = false;
    }
    document.getElementById('quiz-mensaje').textContent = preguntasRespondidas === TOTAL_PREGUNTAS
        ? 'Respondiste todas las preguntas. Presenta el quiz para ver tu nota.'
        : esCorrecta ? '¡Bien hecho, sigue así!' : 'Aprender también cuenta. ¡Vamos con la siguiente!';
}

function avanzarQuiz() {
    if (preguntasRespondidas < preguntaActual) return;

    if (preguntaActual === TOTAL_PREGUNTAS) {
        presentarQuiz();
        return;
    }

    document.getElementById(`q${preguntaActual}`).classList.remove('active');
    preguntaActual++;
    const siguientePregunta = document.getElementById(`q${preguntaActual}`);
    siguientePregunta.classList.add('active');
    document.getElementById('quiz-progreso-texto').textContent = `Pregunta ${preguntaActual} de ${TOTAL_PREGUNTAS}`;
    document.getElementById('quiz-feedback').hidden = true;
    document.getElementById('quiz-siguiente').hidden = true;
    document.getElementById('quiz-siguiente').disabled = true;
    siguientePregunta.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function presentarQuiz() {
    if (preguntasRespondidas !== TOTAL_PREGUNTAS) return;

    const nota = (respuestasCorrectas * PUNTOS_POR_PREGUNTA).toFixed(1);
    const porcentaje = Math.round((respuestasCorrectas / TOTAL_PREGUNTAS) * 100);

    document.getElementById('nota-final').innerText = `Tu nota: ${nota} / ${NOTA_MAXIMA.toFixed(1)} (${porcentaje}% de aciertos)`;
    document.getElementById('texto-resultado-quiz').innerText = 'Tu nota ha sido guardada. El docente podrá verla en su panel.';

    const datos = cargarDatos();
    datos.quizzes.unshift({
        estudiante: usuarioActual.nombre,
        documento: usuarioActual.documento,
        nota: parseFloat(nota),
        porcentaje: porcentaje,
        correctas: respuestasCorrectas,
        total: TOTAL_PREGUNTAS,
        respuestas: [...respuestasUsuario],
        fecha: new Date().toLocaleString()
    });
    guardarDatos(datos);

    document.getElementById('quiz-interaccion').style.display = 'none';
    document.getElementById('resultado-quiz').style.display = 'block';
}

/* ==========================================
   PANELES DE ADMINISTRACIÓN
   ========================================== */
function actualizarPanelDocente() {
    let datos = cargarDatos();

    const tbodyQuizzes = document.querySelector('#tabla-quizzes tbody');
    tbodyQuizzes.innerHTML = '';
    const quizzesEstudiantes = datos.quizzes.filter(q => q.estudiante !== usuarioActual.nombre);
    
    if (quizzesEstudiantes.length === 0) {
        tbodyQuizzes.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">Ningún estudiante ha presentado el quiz aún.</td></tr>';
    } else {
        quizzesEstudiantes.forEach(q => {
            const fila = document.createElement('tr');
            const colorNota = q.nota >= 3.5 ? 'var(--verde)' : q.nota >= 2.5 ? 'var(--naranja)' : 'var(--rojo)';
            const estudianteCell = document.createElement('td');
            estudianteCell.textContent = q.estudiante;

            const notaCell = document.createElement('td');
            const notaTexto = document.createElement('strong');
            notaTexto.style.color = colorNota;
            notaTexto.textContent = q.nota.toFixed(1);
            notaCell.appendChild(notaTexto);

            const porcentajeCell = document.createElement('td');
            porcentajeCell.textContent = `${q.porcentaje}%`;

            const accionesCell = document.createElement('td');
            const acciones = document.createElement('div');
            acciones.className = 'quiz-actions-cell';

            const verQuizButton = document.createElement('button');
            verQuizButton.type = 'button';
            verQuizButton.className = 'btn-admin btn-azul quiz-action-btn';
            verQuizButton.textContent = '🔎 Ver quiz';
            verQuizButton.addEventListener('click', () => mostrarDetalleQuiz(q));

            const repetirButton = document.createElement('button');
            repetirButton.type = 'button';
            repetirButton.className = 'btn-admin btn-rojo quiz-action-btn';
            repetirButton.textContent = '🔄 Permitir Repetir';
            repetirButton.addEventListener('click', () => borrarQuiz(q.documento));

            acciones.append(verQuizButton, repetirButton);
            accionesCell.appendChild(acciones);
            fila.append(estudianteCell, notaCell, porcentajeCell, accionesCell);
            tbodyQuizzes.appendChild(fila);
        });
    }

    const tbodyRegistros = document.querySelector('#tabla-registros-docente tbody');
    tbodyRegistros.innerHTML = '';
    const clasificacionesEstudiantes = datos.clasificaciones.filter(c => c.rol === 'Estudiante');

    if (clasificacionesEstudiantes.length === 0) {
        tbodyRegistros.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">No hay registros de clasificación de estudiantes.</td></tr>';
    } else {
        clasificacionesEstudiantes.forEach(c => {
            const fila = document.createElement('tr');
            [c.usuario, c.residuo, c.caneca].forEach(valor => {
                const celda = document.createElement('td');
                celda.textContent = valor;
                fila.appendChild(celda);
            });
            tbodyRegistros.appendChild(fila);
        });
    }

    const tbodyManualidades = document.querySelector('#tabla-registros-manualidades tbody');
    tbodyManualidades.innerHTML = '';
    const manualidadesEstudiantes = datos.manualidades.filter(m => m.rol === 'Estudiante');

    if (manualidadesEstudiantes.length === 0) {
        tbodyManualidades.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#999;">No hay registros de manualidades de estudiantes.</td></tr>';
    } else {
        manualidadesEstudiantes.forEach(m => {
            const fila = document.createElement('tr');
            [m.usuario, m.manualidad].forEach(valor => {
                const celda = document.createElement('td');
                celda.textContent = valor;
                fila.appendChild(celda);
            });
            tbodyManualidades.appendChild(fila);
        });
    }
}

function mostrarDetalleQuiz(quiz) {
    const dialogo = document.getElementById('dialogo-revision-quiz');
    const contenido = document.getElementById('revision-quiz-contenido');
    document.getElementById('revision-quiz-estudiante').textContent =
        `${quiz.estudiante} · Nota: ${quiz.nota.toFixed(1)} / ${NOTA_MAXIMA.toFixed(1)} (${quiz.porcentaje}%)`;
    contenido.replaceChildren();

    if (!Array.isArray(quiz.respuestas)) {
        const aviso = document.createElement('p');
        aviso.className = 'revision-quiz-aviso';
        aviso.textContent = 'Este intento no tiene respuestas detalladas guardadas.';
        contenido.appendChild(aviso);
        dialogo.showModal();
        return;
    }

    for (let numero = 1; numero <= TOTAL_PREGUNTAS; numero++) {
        const idPregunta = `q${numero}`;
        const pregunta = document.getElementById(idPregunta);
        const preguntaTexto = pregunta.querySelector('h3').textContent.trim();
        const opciones = Array.from(pregunta.querySelectorAll('.opciones button'));
        const indiceElegido = quiz.respuestas[numero - 1];
        const indiceCorrecto = RESPUESTAS_CORRECTAS[idPregunta];
        const tarjeta = document.createElement('article');
        tarjeta.className = 'revision-quiz-pregunta';

        const tituloPregunta = document.createElement('h4');
        tituloPregunta.textContent = preguntaTexto;
        tarjeta.appendChild(tituloPregunta);

        if (!Number.isInteger(indiceElegido) || !opciones[indiceElegido]) {
            const sinRespuesta = document.createElement('p');
            sinRespuesta.className = 'revision-quiz-sin-respuesta';
            sinRespuesta.textContent = 'No hay una respuesta guardada para esta pregunta.';
            tarjeta.appendChild(sinRespuesta);
        } else {
            const respuestaCorrecta = indiceElegido === indiceCorrecto;
            const respuestaElegida = document.createElement('p');
            respuestaElegida.className = respuestaCorrecta
                ? 'revision-quiz-respuesta revision-quiz-correcta'
                : 'revision-quiz-respuesta revision-quiz-incorrecta';
            respuestaElegida.textContent = `${respuestaCorrecta ? '✅ Correcta' : '❌ Incorrecta'}: ${opciones[indiceElegido].textContent.trim()}`;
            tarjeta.appendChild(respuestaElegida);

            if (!respuestaCorrecta && opciones[indiceCorrecto]) {
                const respuestaEsperada = document.createElement('p');
                respuestaEsperada.className = 'revision-quiz-respuesta revision-quiz-correcta';
                respuestaEsperada.textContent = `Respuesta correcta: ${opciones[indiceCorrecto].textContent.trim()}`;
                tarjeta.appendChild(respuestaEsperada);
            }
        }

        contenido.appendChild(tarjeta);
    }

    dialogo.showModal();
}

// Nueva función: el docente puede borrar un quiz para que el estudiante lo repita
function borrarQuiz(documento) {
    let datos = cargarDatos();
    const quiz = datos.quizzes.find(q => q.documento === documento);
    
    if (!quiz) return;
    
    if (confirm(`¿Permitir que ${quiz.estudiante} vuelva a presentar el quiz?\n\nEsto borrará su nota actual (${quiz.nota}/5.0).`)) {
        datos.quizzes = datos.quizzes.filter(q => q.documento !== documento);
        guardarDatos(datos);
        alert(`✅ El quiz de ${quiz.estudiante} ha sido borrado. Podrá volver a presentarlo.`);
        actualizarPanelDocente();
    }
}

function actualizarPanelCoordinador() {
    let datos = cargarDatos();

    document.getElementById('stat-total-clasificaciones').innerText = datos.clasificaciones.length;
    document.getElementById('stat-total-quizzes').innerText = datos.quizzes.length;
    
    const usuariosUnicos = new Set(datos.usuarios.map(u => u.documento));
    document.getElementById('stat-usuarios-unicos').innerText = usuariosUnicos.size;

    let promedio = 0;
    if (datos.quizzes.length > 0) {
        const suma = datos.quizzes.reduce((acc, q) => acc + q.nota, 0);
        promedio = (suma / datos.quizzes.length).toFixed(1);
    }
    document.getElementById('stat-promedio').innerText = promedio;

    const tbodyIngresos = document.querySelector('#tabla-ingresos tbody');
    tbodyIngresos.innerHTML = '';
    if (datos.usuarios.length === 0) {
        tbodyIngresos.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999;">No hay usuarios registrados.</td></tr>';
    } else {
        const usuariosOrdenados = [...datos.usuarios].sort((a, b) => 
            new Date(b.ultimoIngreso) - new Date(a.ultimoIngreso)
        );
        
        usuariosOrdenados.forEach(u => {
            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td><strong>${u.nombre}</strong></td>
                <td>${u.documento}</td>
                <td><span style="background:${u.rol === 'Estudiante' ? '#e3f2fd' : u.rol === 'Docente' ? '#fff3e0' : '#e8f5e9'}; padding:2px 6px; border-radius:4px; font-size:0.8rem;">${u.rol}</span></td>
                <td>${u.ultimoIngreso}</td>
                <td style="text-align:center;"><strong>${u.totalIngresos}</strong></td>
            `;
            tbodyIngresos.appendChild(fila);
        });
    }

    const tbodyExtendido = document.querySelector('#tabla-registros-coordinador tbody');
    tbodyExtendido.innerHTML = '';
    let todasLasActividades = [];

    datos.clasificaciones.forEach(c => {
        todasLasActividades.push({
            usuario: c.usuario,
            rol: c.rol,
            tipo: 'Clasificación',
            detalle: `Clasificó "${c.residuo}" en caneca ${c.caneca}`,
            fechaISO: c.fechaISO || c.fecha || ''
        });
    });

    datos.manualidades.forEach(m => {
        todasLasActividades.push({
            usuario: m.usuario,
            rol: m.rol,
            tipo: 'Manualidad',
            detalle: `Interactuó con "${m.manualidad}"`,
            fechaISO: m.fechaISO || ''
        });
    });

    datos.quizzes.forEach(q => {
        todasLasActividades.push({
            usuario: q.estudiante,
            rol: 'Estudiante',
            tipo: 'Quiz',
            detalle: `Obtuvo nota ${q.nota.toFixed(1)}/5.0 (${q.porcentaje}%)`,
            fechaISO: q.fechaISO || q.fecha || ''
        });
    });

    todasLasActividades.sort((a, b) => {
        const fechaA = Date.parse(a.fechaISO);
        const fechaB = Date.parse(b.fechaISO);
        const fechaAValida = Number.isFinite(fechaA);
        const fechaBValida = Number.isFinite(fechaB);
        if (fechaAValida !== fechaBValida) return fechaAValida ? -1 : 1;
        if (!fechaAValida) return 0;
        return fechaB - fechaA;
    });

    if (todasLasActividades.length === 0) {
        tbodyExtendido.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">No hay actividades registradas.</td></tr>';
    } else {
        todasLasActividades.slice(0, 30).forEach(a => {
            const fila = document.createElement('tr');
            const usuarioCell = document.createElement('td');
            usuarioCell.textContent = a.usuario;
            const rolCell = document.createElement('td');
            rolCell.textContent = a.rol;
            const tipoCell = document.createElement('td');
            const tipoTexto = document.createElement('strong');
            tipoTexto.textContent = a.tipo;
            tipoCell.appendChild(tipoTexto);
            const detalleCell = document.createElement('td');
            detalleCell.textContent = a.detalle;
            fila.append(usuarioCell, rolCell, tipoCell, detalleCell);
            tbodyExtendido.appendChild(fila);
        });
    }
}

/* ==========================================
   ACCIONES DEL COORDINADOR
   ========================================== */
function terminarDia() {
    if (!confirm('¿Estás seguro de que quieres TERMINAR EL DÍA?\n\nSe generará un archivo de respaldo y se borrarán TODOS los datos actuales.')) {
        return;
    }

    let datos = cargarDatos();
    const ahora = new Date();
    const nombreArchivo = `Respaldo_${ahora.getFullYear()}-${(ahora.getMonth()+1).toString().padStart(2,'0')}-${ahora.getDate().toString().padStart(2,'0')}_${ahora.getHours().toString().padStart(2,'0')}-${ahora.getMinutes().toString().padStart(2,'0')}.json`;
    
    const dataStr = JSON.stringify(datos, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setTimeout(() => {
        localStorage.removeItem('eco_usuarios');
        localStorage.removeItem('eco_clasificaciones');
        localStorage.removeItem('eco_quizzes');
        localStorage.removeItem('eco_manualidades');
        alert(`✅ Día terminado.\n\n📥 El respaldo "${nombreArchivo}" se ha descargado.\n\n💾 Guárdalo en tu carpeta D:\\respaldo\\\n\n🗑️ Los datos han sido borrados.`);
        actualizarPanelCoordinador();
    }, 800);
}

function exportarDatos() {
    let datos = cargarDatos();
    const ahora = new Date();
    const nombreArchivo = `EcoVision_Manual_${ahora.getFullYear()}-${(ahora.getMonth()+1).toString().padStart(2,'0')}-${ahora.getDate().toString().padStart(2,'0')}.json`;
    
    const dataStr = JSON.stringify(datos, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert(`📥 Archivo "${nombreArchivo}" descargado.\n\nGuárdalo en tu carpeta D:\\respaldo\\`);
}

function importarDatos(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = function(e) {
        try {
            const datosImportados = JSON.parse(e.target.result);
            
            if (!datosImportados.usuarios || !datosImportados.clasificaciones || !datosImportados.quizzes) {
                alert('❌ El archivo no tiene el formato correcto de EcoVisión.');
                return;
            }

            if (confirm(`¿Cargar los datos del archivo "${archivo.name}"?\n\nEsto REEMPLAZARÁ los datos actuales.`)) {
                datosImportados.manualidades = Array.isArray(datosImportados.manualidades) ? datosImportados.manualidades : [];
                guardarDatos(datosImportados);
                alert('✅ Datos importados exitosamente.');
                actualizarPanelCoordinador();
            }
        } catch (error) {
            alert('❌ Error al leer el archivo. Asegúrate de que sea un respaldo válido de EcoVisión.');
        }
    };
    lector.readAsText(archivo);
    event.target.value = '';
}