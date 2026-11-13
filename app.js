
// WEBGL VORBEREITEN
const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl");

if (!gl) {
    throw new Error("WebGL wird nicht unterstützt.");
}

gl.clearColor(0.97, 0.98, 1.0, 1.0);
gl.enable(gl.DEPTH_TEST);

// SHADER MIT MATRIZEN
const vertexShaderSource = `
    attribute vec3 position;
    attribute vec3 color;

    uniform mat4 modelMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 projectionMatrix;

    varying vec3 vColor;

    void main() {
        vColor = color;

        gl_Position = projectionMatrix
                    * viewMatrix
                    * modelMatrix
                    * vec4(position, 1.0);
    }
`;

const fragmentShaderSource = `
    precision mediump float;

    varying vec3 vColor;

    void main() {
        gl_FragColor = vec4(vColor, 1.0);
    }
`;

// SHADER ERSTELLEN
function createShader(type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
}

const program = gl.createProgram();

gl.attachShader(
    program,
    createShader(gl.VERTEX_SHADER, vertexShaderSource)
);

gl.attachShader(
    program,
    createShader(gl.FRAGMENT_SHADER, fragmentShaderSource)
);

gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
}

gl.useProgram(program);

const positionLocation = gl.getAttribLocation(program, "position");
const colorLocation = gl.getAttribLocation(program, "color");

// MATRIZEN
const modelLocation = gl.getUniformLocation(program, "modelMatrix");
const viewLocation = gl.getUniformLocation(program, "viewMatrix");
const projectionLocation = gl.getUniformLocation(program, "projectionMatrix");

// EINHEITSMATRIX
function identityMatrix() {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

// MODELL VERSCHIEBEN
function translationMatrix(x, y, z) {
    const matrix = identityMatrix();

    matrix[12] = x;
    matrix[13] = y;
    matrix[14] = z;

    return matrix;
}

// VEKTOR NORMIEREN
function normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]);

    return [
        v[0] / length,
        v[1] / length,
        v[2] / length
    ];
}

// KREUZPRODUKT
function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

// SKALARPRODUKT
function dot(a, b) {
    return a[0] * b[0]
        + a[1] * b[1]
        + a[2] * b[2];
}

// LOOKAT-FUNKTION
function lookAt(eye, center, up) {
    const z = normalize([
        eye[0] - center[0],
        eye[1] - center[1],
        eye[2] - center[2]
    ]);

    const x = normalize(cross(up, z));
    const y = cross(z, x);

    return new Float32Array([
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
    ]);
}

// PERSPEKTIVE
function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);

    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / (near - far), -1,
        0, 0, 2 * far * near / (near - far), 0
    ]);
}

// KAMERA
const camera = {
    angle: 0.6,
    distance: 6.2,
    height: 2.2
};

// KAMERAPOSITION BERECHNEN
function cameraPosition() {
    return [
        camera.distance * Math.sin(camera.angle),
        camera.height,
        camera.distance * Math.cos(camera.angle)
    ];
}

// FORM 1: MÖBIUSBAND (AUS EA4)
function moebius(u, v) {
    const radius = 0.55;
    const breite = 0.22 * v;

    const abstand = radius + breite * Math.cos(u / 2);

    const x = abstand * Math.cos(u);
    const y = abstand * Math.sin(u);
    const z = breite * Math.sin(u / 2);

    return [x, y, z];
}

// FORM 2: HELICOID (AUS EA4)
function helicoid(u, v) {
    const radius = 0.65 * v;

    const x = radius * Math.cos(u);
    const y = radius * Math.sin(u);
    const z = 0.13 * (u - 2 * Math.PI);

    return [x, y, z];
}

// MEHRERE MODELLE
const models = [];

let recursionDepth = 2;
let wireframeOnly = false;

// MODELL UND BUFFER ERSTELLEN
function createModel(positions, colors, triangles, lines, x, y, z) {
    const model = {
        positionBuffer: gl.createBuffer(),
        colorBuffer: gl.createBuffer(),
        triangleBuffer: gl.createBuffer(),
        lineBuffer: gl.createBuffer(),

        triangleCount: triangles.length,
        lineCount: lines.length,

        matrix: translationMatrix(x, y, z)
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, model.positionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, model.colorBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(colors),
        gl.STATIC_DRAW
    );

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.triangleBuffer);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(triangles),
        gl.STATIC_DRAW
    );

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.lineBuffer);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(lines),
        gl.STATIC_DRAW
    );

    return model;
}

// ALTE BUFFER LÖSCHEN
function deleteModel(model) {
    gl.deleteBuffer(model.positionBuffer);
    gl.deleteBuffer(model.colorBuffer);
    gl.deleteBuffer(model.triangleBuffer);
    gl.deleteBuffer(model.lineBuffer);
}

// FLÄCHE ERSTELLEN
function createSurface(type, x, y, z) {
    const positions = [];
    const colors = [];
    const triangles = [];
    const lines = [];

    const segmentsU = 80;
    const segmentsV = 40;

    for (let i = 0; i <= segmentsU; i++) {
        const u = i / segmentsU * 4 * Math.PI;

        for (let j = 0; j <= segmentsV; j++) {
            const v = -1 + 2 * j / segmentsV;

            let point;

            if (type === "moebius") {
                point = moebius(u / 2, v);
            } else {
                point = helicoid(u, v);
            }

            positions.push(point[0], point[1], point[2]);

            const shade = j / segmentsV;

            if (type === "moebius") {
                colors.push(0.2, 0.5 + 0.3 * shade, 0.9);
            } else {
                colors.push(0.2, 0.8, 0.4 + 0.3 * shade);
            }
        }
    }

    // DREIECKE UND LINIEN
    for (let i = 0; i < segmentsU; i++) {
        for (let j = 0; j < segmentsV; j++) {
            const a = i * (segmentsV + 1) + j;
            const b = (i + 1) * (segmentsV + 1) + j;
            const c = a + 1;
            const d = b + 1;

            triangles.push(a, b, c);
            triangles.push(b, d, c);

            lines.push(a, b);
            lines.push(a, c);
        }
    }

    // ÄUSSERE LINIEN
    for (let i = 0; i < segmentsU; i++) {
        const a = i * (segmentsV + 1) + segmentsV;
        lines.push(a, a + segmentsV + 1);
    }

    for (let j = 0; j < segmentsV; j++) {
        const a = segmentsU * (segmentsV + 1) + j;
        lines.push(a, a + 1);
    }

    return createModel(
        positions,
        colors,
        triangles,
        lines,
        x, y, z
    );
}

// MITTELPUNKT ZWEIER PUNKTE
function midpoint(a, b) {
    return normalize([
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        (a[2] + b[2]) / 2
    ]);
}

// KUGEL ERSTELLEN
function createSphere(depth) {
    const positions = [];
    const colors = [];
    const triangles = [];
    const lines = [];

    // OKTAEDER
    const top = [0, 1, 0];
    const bottom = [0, -1, 0];

    const front = [0, 0, 1];
    const right = [1, 0, 0];
    const back = [0, 0, -1];
    const left = [-1, 0, 0];

    // DREIECK REKURSIV TEILEN
    function subdivide(a, b, c, depthLeft) {
        if (depthLeft > 0) {
            const ab = midpoint(a, b);
            const bc = midpoint(b, c);
            const ca = midpoint(c, a);

            subdivide(a, ab, ca, depthLeft - 1);
            subdivide(ab, b, bc, depthLeft - 1);
            subdivide(ca, bc, c, depthLeft - 1);
            subdivide(ab, bc, ca, depthLeft - 1);

            return;
        }

        const start = positions.length / 3;

        // DREI PUNKTE SPEICHERN
        for (const p of [a, b, c]) {
            positions.push(
                p[0] * 0.65,
                p[1] * 0.65,
                p[2] * 0.65
            );

            colors.push(
                0.45 + 0.35 * p[0],
                0.55 + 0.30 * p[1],
                0.65 + 0.25 * p[2]
            );
        }

        triangles.push(start, start + 1, start + 2);

        lines.push(
            start, start + 1,
            start + 1, start + 2,
            start + 2, start
        );
    }

    // ACHT DREIECKE
    const ring = [front, right, back, left];

    for (let i = 0; i < 4; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % 4];

        subdivide(top, a, b, depth);
        subdivide(bottom, b, a, depth);
    }

    return createModel(
        positions,
        colors,
        triangles,
        lines,
        0, 0, 0
    );
}

// REKURSION ÄNDERN
function changeDepth(step) {
    const next = Math.max(
        0,
        Math.min(5, recursionDepth + step)
    );

    if (next === recursionDepth) {
        return;
    }

    recursionDepth = next;

    deleteModel(models[2]);
    models[2] = createSphere(recursionDepth);

    document.getElementById("depthInfo").textContent =
        "Rekursionstiefe: " + recursionDepth;

    draw();
}

// SZENE ZEICHNEN
function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clear(
        gl.COLOR_BUFFER_BIT |
        gl.DEPTH_BUFFER_BIT
    );

    // KAMERA
    const eye = cameraPosition();

    const view = lookAt(
        eye,
        [0, 0, 0],
        [0, 1, 0]
    );

    const projection = perspective(
        Math.PI / 4,
        canvas.width / canvas.height,
        0.1,
        100
    );

    gl.uniformMatrix4fv(viewLocation, false, view);
    gl.uniformMatrix4fv(projectionLocation, false, projection);

    // ALLE MODELLE ZEICHNEN
    for (const model of models) {
        gl.uniformMatrix4fv(
            modelLocation,
            false,
            model.matrix
        );

        // POSITIONEN
        gl.bindBuffer(gl.ARRAY_BUFFER, model.positionBuffer);

        gl.vertexAttribPointer(
            positionLocation,
            3,
            gl.FLOAT,
            false,
            0,
            0
        );

        gl.enableVertexAttribArray(positionLocation);

        // FÜLLUNG
        if (!wireframeOnly) {
            gl.bindBuffer(gl.ARRAY_BUFFER, model.colorBuffer);

            gl.vertexAttribPointer(
                colorLocation,
                3,
                gl.FLOAT,
                false,
                0,
                0
            );

            gl.enableVertexAttribArray(colorLocation);

            gl.enable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(1, 1);

            gl.bindBuffer(
                gl.ELEMENT_ARRAY_BUFFER,
                model.triangleBuffer
            );

            gl.drawElements(
                gl.TRIANGLES,
                model.triangleCount,
                gl.UNSIGNED_SHORT,
                0
            );

            gl.disable(gl.POLYGON_OFFSET_FILL);
        }

        // LINIEN
        gl.disableVertexAttribArray(colorLocation);
        gl.vertexAttrib3f(colorLocation, 0.12, 0.12, 0.12);

        gl.bindBuffer(
            gl.ELEMENT_ARRAY_BUFFER,
            model.lineBuffer
        );

        gl.drawElements(
            gl.LINES,
            model.lineCount,
            gl.UNSIGNED_SHORT,
            0
        );
    }

    // ANZEIGEN
    document.getElementById("modeInfo").textContent =
        "Darstellung: " +
        (wireframeOnly ? "Linien" : "Füllung");

    const angle = (
        (camera.angle * 180 / Math.PI) % 360 + 360
    ) % 360;

    document.getElementById("cameraInfo").textContent =
        "Kameraabstand: " + camera.distance.toFixed(1) +
        " | Höhe: " + camera.height.toFixed(1) +
        " | Winkel: " + angle.toFixed(0) + "°";
}

// DARSTELLUNG WECHSELN
function toggleMode() {
    wireframeOnly = !wireframeOnly;
    draw();
}

// TASTATURSTEUERUNG
window.addEventListener("keydown", function(event) {
    if (event.key === "ArrowLeft") {
        camera.angle -= Math.PI / 36;

    } else if (event.key === "ArrowRight") {
        camera.angle += Math.PI / 36;

    } else if (event.key === "ArrowUp") {
        camera.height += 0.2;

    } else if (event.key === "ArrowDown") {
        camera.height -= 0.2;

    } else if (event.key.toLowerCase() === "n") {
        if (event.shiftKey) {
            camera.distance -= 0.3;
        } else {
            camera.distance += 0.3;
        }

        camera.distance = Math.max(
            2.8,
            Math.min(15, camera.distance)
        );

    } else {
        return;
    }

    event.preventDefault();
    draw();
});

// SZENE STARTEN
models.push(createSurface("moebius", -1.4, 0, 0));
models.push(createSurface("helicoid", 1.4, 0, 0));
models.push(createSphere(recursionDepth));

draw();
