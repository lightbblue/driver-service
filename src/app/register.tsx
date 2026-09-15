
// ==========================================
// FUNCIONES GENERALES
// ==========================================

function getInput(id: string): HTMLInputElement {
    return document.getElementById(id) as HTMLInputElement;
}

function getElement(id: string): HTMLElement {
    return document.getElementById(id) as HTMLElement;
}

function go(id: string): void {

    document.querySelectorAll<HTMLElement>(".screen")
        .forEach((screen: HTMLElement) => {
            screen.classList.remove("active");
        });

    const pantalla: HTMLElement | null =
        document.getElementById(id);

    if (pantalla) {
        pantalla.classList.add("active");
    }
}


// ==========================================
// REGISTRO DE USUARIO
// ==========================================

function registerUser(): void {

    const nombre: string =
        getInput("rNombre").value.trim();

    const email: string =
        getInput("rEmail").value.trim();

    const telefono: string =
        getInput("rTel").value.trim();

    const password: string =
        getInput("rPass").value;

    const passwordConfirm: string =
        getInput("rPass2").value;

    const error: HTMLElement =
        getElement("rError");


    // Campos obligatorios
    if (
        !nombre ||
        !email ||
        !telefono ||
        !password ||
        !passwordConfirm
    ) {
        error.textContent =
            "Completá todos los campos.";

        return;
    }


    // Validar email
    if (!email.includes("@")) {

        error.textContent =
            "Ingresá un correo válido.";

        return;
    }


    // Validar contraseña
    if (password.length < 6) {

        error.textContent =
            "La contraseña debe tener al menos 6 caracteres.";

        return;
    }


    // Confirmar contraseña
    if (password !== passwordConfirm) {

        error.textContent =
            "Las contraseñas no coinciden.";

        return;
    }


    // Registro correcto
    error.textContent = "";

    console.log("===== REGISTRO DE USUARIO =====");
    console.log("Nombre:", nombre);
    console.log("Email:", email);
    console.log("Teléfono:", telefono);

    alert("¡Cuenta de usuario creada correctamente!");

    // Volver al login de usuario
    go("loginUsuario");
}


// ==========================================
// REGISTRO DE MECÁNICO
// ==========================================

function registerMechanic(): void {

    const nombre: string =
        getInput("mnombre").value.trim();

    const email: string =
        getInput("memail2").value.trim();

    const telefono: string =
        getInput("mtel").value.trim();

    const dni: string =
        getInput("mdni").value.trim();

    const password: string =
        getInput("mpass2").value;

    const passwordConfirm: string =
        getInput("mpass3").value;

    const ubicacion: string =
        getInput("mubicacion").value.trim();

    const error: HTMLElement =
        getElement("mregError");


    // Campos obligatorios
    if (
        !nombre ||
        !email ||
        !telefono ||
        !dni ||
        !password ||
        !passwordConfirm ||
        !ubicacion
    ) {

        error.textContent =
            "Completá los campos obligatorios.";

        return;
    }


    // Validar email
    if (!email.includes("@")) {

        error.textContent =
            "Ingresá un correo válido.";

        return;
    }


    // Validar contraseña
    if (password.length < 6) {

        error.textContent =
            "La contraseña debe tener al menos 6 caracteres.";

        return;
    }


    // Confirmar contraseña
    if (password !== passwordConfirm) {

        error.textContent =
            "Las contraseñas no coinciden.";

        return;
    }


    // Registro correcto
    error.textContent = "";

    console.log("===== REGISTRO DE MECÁNICO =====");
    console.log("Nombre:", nombre);
    console.log("Email:", email);
    console.log("Teléfono:", telefono);
    console.log("DNI:", dni);
    console.log("Ubicación:", ubicacion);

    alert("¡Registro de mecánico realizado correctamente!");

    // Ir a pantalla de éxito
    go("exito");
}


// ==========================================
// HACER LAS FUNCIONES ACCESIBLES DESDE HTML
// ==========================================

(window as any).registerUser =
    registerUser;

(window as any).registerMechanic =
    registerMechanic;

(window as any).go =
    go;


