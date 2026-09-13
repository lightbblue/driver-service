-- init.sql

-- Tabla: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla: tipos_problema
CREATE TABLE IF NOT EXISTS tipos_problema (
    id_tipo_problema SERIAL PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL
);

INSERT INTO tipos_problema (descripcion) VALUES
('Pinchadura'),
('Cadena'),
('Batería'),
('Combustible'),
('Falla Mecánica'),
('Traslado');

-- Tabla: estados_solicitud
CREATE TABLE IF NOT EXISTS estados_solicitud (
    id_estado SERIAL PRIMARY KEY,
    descripcion VARCHAR(50) NOT NULL
);

INSERT INTO estados_solicitud (descripcion) VALUES
('Pendiente'),
('Presupuestada'),
('Aceptada'),
('Cancelada'),
('Finalizada');

-- Tabla: solicitudes
CREATE TABLE IF NOT EXISTS solicitudes (
    id_solicitud SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    id_tipo_problema INTEGER NOT NULL,
    id_estado INTEGER NOT NULL,
    descripcion TEXT,
    ubicacion VARCHAR(250),
    foto_url VARCHAR(500),
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario),

    CONSTRAINT fk_tipo_problema
        FOREIGN KEY (id_tipo_problema)
        REFERENCES tipos_problema(id_tipo_problema),

    CONSTRAINT fk_estado
        FOREIGN KEY (id_estado)
        REFERENCES estados_solicitud(id_estado)
);

-- Tabla: presupuestos
CREATE TABLE IF NOT EXISTS presupuestos (
    id_presupuesto SERIAL PRIMARY KEY,
    id_solicitud INTEGER UNIQUE NOT NULL,

    costo_mano_obra NUMERIC(10,2) NOT NULL,
    costo_repuestos NUMERIC(10,2) DEFAULT 0,
    costo_asistencia NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,

    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'PENDIENTE',

    CONSTRAINT fk_solicitud
        FOREIGN KEY (id_solicitud)
        REFERENCES solicitudes(id_solicitud)
);