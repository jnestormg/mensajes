# Especificación: Sistema de Mensajería LAN

## 1. Objetivo

Crear un sistema de mensajería que permita enviar mensajes entre computadoras conectadas a la misma red local (LAN).

La red puede contener computadoras con diferentes sistemas operativos:

- Windows
- Linux

El sistema debe funcionar sin depender de Internet. La comunicación debe realizarse exclusivamente dentro de la red local.

Una computadora funcionará como **servidor central** y las demás como **clientes**.

---

# 2. Arquitectura

Utilizar una arquitectura cliente-servidor.

```text
ip addrip addr                         RED LOCAL
                             │
                             │
                    ┌────────▼────────┐
                    │     SERVIDOR    │
                    │                 │
                    │ Node.js         │
                    │ Express         │
                    │ Socket.IO       │
                    │                 │
                    │ 192.168.1.10    │
                    └────────┬────────┘
                             │
               ┌─────────────┼─────────────┐
               │             │             │
        ┌──────▼──────┐ ┌────▼───────┐ ┌───▼────────┐
        │   CLIENTE   │ │  CLIENTE   │ │  CLIENTE   │
        │   Windows   │ │   Windows  │ │   Linux    │
        └─────────────┘ └────────────┘ └────────────┘
```

El servidor será responsable de:

- Mantener las conexiones.
- Registrar clientes conectados.
- Identificar cada cliente.
- Recibir mensajes.
- Enviar mensajes a clientes específicos.
- Enviar mensajes a todos los clientes.
- Informar cuando un cliente se conecta.
- Informar cuando un cliente se desconecta.

---

# 3. Tecnologías

## Backend

Utilizar:

- Node.js
- Express
- Socket.IO

No utilizar frameworks backend adicionales salvo que sean estrictamente necesarios.

## Frontend

Utilizar inicialmente:

- HTML
- CSS
- JavaScript

No utilizar React, Angular o Vue en la primera versión.

El objetivo es mantener el proyecto sencillo y fácil de entender.

---

# 4. Comunicación

La comunicación en tiempo real debe realizarse mediante **Socket.IO**.

No utilizar polling manual.

El cliente debe establecer una conexión WebSocket/Socket.IO con el servidor.

Ejemplo:

```text
Cliente
   │
   │ Socket.IOip addr
   ▼
Servidor
   │
   │ Socket.IO
   ▼
Cliente destino
```

---

# 5. Identificación de clientes

Cada cliente debe proporcionar un nombre al conectarse.

Ejemplo:

```text
PC-01
PC-02
PC-03
```

La aplicación debe solicitar el nombre al usuario al iniciar.ip addr

Ejemplo:

```text
Nombre de esta computadora:

[ PC-02 ]

[ Conectar ]
```

El nombre debe enviarse al servidor mediante Socket.IO.

El servidor mantendrá en memoria una lista de clientes conectados.

Ejemplo:

```javascript
[
    {
        socketId: "...",
        name: "PC-01"
    },
    {
        socketId: "...",
        name: "PC-02"
    }
]
```

No utilizar base de datos en la primera versión.

---

# 6. Funcionalidades

## 6.1 Conexión

Cuando un cliente se conecte:

1. Debe proporcionar su nombre.
2. El servidor debe registrar el cliente.
3. El servidor debe notificar al resto de clientes.
4. Todos los clientes deben actualizar su lista de usuarios conectados.

Ejemplo:

```text
PC-02 se ha conectado.
```

---

# 6.2 Desconexión

Cuando un cliente cierre la página o pierda la conexión:

1. El servidor debe eliminarlo de la lista.
2. Los demás clientes deben recibir la actualización.
3. La interfaz debe mostrarlo como desconectado o eliminarlo de la lista.

Ejemplo:

```text
PC-02 se ha desconectado.
```

---

# 6.3 Lista de clientes

La interfaz debe mostrar los clientes conectados.

Ejemplo:

```text
CLIENTES CONECTADOS

🟢 PC-01
🟢 PC-02
🟢 PC-03
```

El cliente actual debe identificarse claramente.ip addr

Ejemplo:

```text
🟢 PC-02 (Tú)
```

---

# 6.4 Enviar mensaje individual

El usuario debe poder seleccionar una computadora y enviarle un mensaje.

Ejemplo:

```text
Enviar a:

[ PC-03 ]

Mensaje:

┌─────────────────────────────┐
│ ¿Puedes revisar el equipo? │
└─────────────────────────────┘

[ Enviar ]
```

El servidor debe recibir:

```javascript
{
    targetSocketId: "...",
    message: "¿Puedes revisar el equipo?"
}
```

El servidor debe enviar el mensaje únicamente al cliente seleccionado.

---

# 6.5 Enviar mensaje a todos

Debe existir una opción:

```text
[ Todos ]
```

Cuando se seleccione, el mensaje debe enviarse a todos los clientes conectados.

Ejemplo:

```text
Mensaje:

"El sistema se reiniciará en 10 minutos."

Destino:

[ Todos ]

[ Enviar ]
```

---

# 6.6 Mostrar mensajes

Los mensajes deben mostrar:

- Remitente
- Fecha/hora
- Contenido

Ejemplo:

```text
PC-01
10:32

¿Puedes revisar la impresora?
```

Para mensajes recibidos:

```text
PC-02
10:33

Sí, voy a revisarla.
```

---

# 7. Interfaz

Crear una interfaz sencilla y funcional.

Distribución propuesta:

```text
┌──────────────────────────────────────────────────┐
│              MENSAJERÍA LAN                     │
├──────────────────────┬───────────────────────────┤
│ CLIENTES             │ CONVERSACIÓN              │
│                      │                           │
│ 🟢 PC-01             │ PC-02                    │
│ 🟢 PC-02             │                           │
│ 🟢 PC-03             │ PC-02: Hola              │
│                      │                           │
│                      │ Yo: Hola, ¿qué tal?      │
│                      │                           │
│                      ├───────────────────────────┤
│                      │ Mensaje...                │
│                      │                           │
│                      │              [Enviar]     │
└──────────────────────┴───────────────────────────┘
```

La interfaz debe ser responsive y funcionar correctamente en:

- Windows
- Linux

Los usuarios accederán mediante navegador.

---

# 8. Conversaciones

El sistema debe distinguir entre:

## Mensaje individual

```text
PC-01 → PC-02
```

y:

## Mensaje global

```text
PC-01 → TODOS
```

La interfaz debe mostrar claramente el destino.

Ejemplo:

```text
Conversación con PC-02
```

ip addro:

```text
Mensaje para todos
```

---

# 9. Modelo de mensaje

Los mensajes deben manejar una estructura similar a:

```javascript
{
    id: "uuid",
    senderId: "socket-id",
    senderName: "PC-01",
    targetId: "socket-id",
    targetName: "PC-02",
    message: "Hola",
    timestamp: "2026-09-15T12:30:00"
}
```

Para mensajes globales:

```javascript
{
    id: "uuid",
    senderId: "socket-id",
    senderName: "PC-01",
    targetId: "ALL",
    targetName: "Todos",
    message: "Aviso importante",
    timestamp: "2026-09-15T12:30:00"
}
```

---

# 10. Eventos Socket.IO

Utilizar eventos claramente definidos.

Eventos mínimos:

```text
register-client
clients-updated
send-message
receive-message
broadcast-message
client-connected
client-disconnected
```

### register-clientip addr

Cliente → servidor.

```javascript
socket.emit("register-client", {
    name: "PC-01"
});
```

### clients-updated

Servidor → clientes.

Debe contener la lista actualizada.

```javascript
socket.emit("clients-updated", clients);
```

### send-message

Cliente → servidor.

```javascript
socket.emit("send-message", {
    targetId: "...",
    message: "Hola"
});
```

### receive-message

Servidor → cliente.

Entrega un mensaje individual.

### broadcast-message

Servidor → todos los clientes.

Entrega un mensaje global.

---

# 11. API HTTP

Express debe utilizarse principalmente para servir el frontend y proporcionar endpoints básicos.

Crear inicialmente:

```text
GET /
```

Debe devolver la aplicación web.

Crear:

```text
GET /api/health
```

Respuesta:

```json
{
    "status": "ok"
}
```

Crear:

```text
GET /api/clients
```

Debe devolver los clientes actualmente conectados.

Ejemplo:

```json
[
    {
        "id": "...",
        "name": "PC-01"
    },
    {
        "id": "...",
        "name": "PC-02"
    }
]
```

---

# 12. Puerto

El servidor debe utilizar inicialmente:

```text
3000
```

Debe ser configurable mediante variable de entorno.

Ejemplo:

```env
PORT=3000
```

---

# 13. Configuración de red

El servidor debe escuchar en todas las interfaces de red.

No limitarlo únicamente a:

```text
localhost
```

Debe ser posible acceder desde otras computadoras mediante:

```text
http://IP_DEL_SERVIDOR:3000
```

Ejemplo:

```text
http://192.168.1.10:3000
```

El servidor debe funcionar tanto mediante Ethernet como mediante Wi-Fi, siempre que ambas computadoras estén dentro de la misma red local y la infraestructura de red permita la comunicación entre ellas.

---

# 14. Seguridad básica

La primera versión funcionará únicamente dentro de una red local de confianza.

Aun así:

- Validar los nombres de usuario.
- No permitir nombres vacíos.
- Limitar la longitud de los mensajes.
- Sanitizar correctamente el contenido mostrado en HTML.
- No utilizar `innerHTML` con contenido proporcionado directamente por usuarios.
- No ejecutar código recibido desde clientes.
- No exponer información innecesaria del servidor.

Límite sugerido:

```text
Nombre: máximo 30 caracteres
Mensaje: máximo 1000 caracteres
```

---

# 15. Persistencia

No utilizar base de datos en la primera versión.

Los mensajes solamente permanecerán en memoria mientras el servidor esté ejecutándose.

Si el servidor se reinicia:

```text
clientes → se desconectan
historial → se pierde
```

La persistencia será una funcionalidad futura.

---

# 16. Estructura del proyecto

Crear una estructura similar a:

```text
lan-messenger/ip addr
│
├── package.json
├── README.md
├── .gitignore
├── .env.example
│
├── src/
│   ├── server.js
│   │
│   ├── config/
│   │   └── config.js
│   │
│   ├── sockets/
│   │   ├── socketHandler.js
│   │   └── clientManager.js
│   │
│   └── routes/
│       └── health.routes.js
│
└── public/
    ├── index.html
    ├── css/
    │   └── styles.css
    │
    └── js/
        └── app.js
```

No crear archivos innecesarios.

Si el agente considera que una estructura más sencilla es suficiente, debe priorizar simplicidad sobre sobreingeniería.

---

# 17. Scripts npm

El proyecto debe tener como mínimo:

```json
{
    "scripts": {
        "start": "node src/server.js",
        "dev": "node --watch src/server.js"
    }
}
```

---

# 18. Variables de entorno

Crear:

```text
.env.example
```

Contenido:

```env
PORT=3000
HOST=0.0.0.0
```

No subir `.env` al repositorio.

Agregar\:ip addr

```text
.env
node_modules/
```

al `.gitignore`.

---

# 19. README

Crear documentación que explique:

## Requisitos

```text
Node.js
npm
```

## Instalación

```bash
npm install
```

## Desarrolloip addr

```bash
npm run dev
```

## Producción

```bash
npm start
```

## Acceso desde la misma computadora

```text
http://localhost:3000
```

## Acceso desde otra computadora

Obtener la IP del servidor.

Linux:

```bash
hostname -I
```

Windows:

```cmd
ipconfig
```

Después acceder desde el navegador:

```text
http://IP_DEL_SERVIDOR:3000
```

Ejemplo:

```text
http://192.168.1.10:3000
```

---

# 20. Pruebas

El agente debe probar como mínimo:

### Prueba 1

Servidor iniciado correctamente.

```text
GET /api/health
```

Debe devolver:

```json
{
    "status": "ok"
}ip addr
```

### Prueba 2

Conectar dos clientes.

Resultado esperado:

```text
PC-01
PC-02
```

### Prueba 3

PC-01 envía mensaje a PC-02.

Resultado:

```text
PC-02 recibe el mensaje.
PC-01 no debe recibir una segunda copia como mensaje entrante.
```

### Prueba 4

PC-01 envía mensaje a todos.

Resultado:

```text
PC-01
PC-02
PC-03

todos reciben el mensaje.
```

### Prueba 5

PC-02 se desconecta.

Resultado:

```text
PC-02 desaparece de la lista de clientes.
```

### Prueba 6

Conectar desde Windows.

### Prueba 7

Conectar desde Linux.

### Prueba 8

Windows → Linux.

### Prueba 9

Linux → Windows.

---

# 21. Reglas para el agente

El agente debe:

1. Implementar primero una versión funcional mínima.
2. No agregar autenticación, base de datos, Docker u otras tecnologías hasta que sean necesarias.
3. Mantener separadas las responsabilidades del servidor Socket.IO.
4. No almacenar contraseñas ni información sensible.
5. Validar todos los datos provenientes de clientes.
6. Evitar código duplicado.
7. Mantener nombres de variables y funciones claros.
8. Documentar decisiones importantes.
9. Actualizar el README cuando cambie la forma de ejecutar el proyecto.
10. No utilizar servicios externos para la comunicación.
11. El sistema debe poder funcionar completamente sin Internet una vez instaladas las dependencias.
12. No depender del sistema operativo del cliente.

---

# 22. Criterios de aceptación

El proyecto se considera terminado cuando:

- [ ] El servidor inicia correctamente.
- [ ] Express sirve la aplicación.
- [ ] Socket.IO permite conexiones.
- [ ] Un cliente puede registrarse con un nombre.
- [ ] Los clientes conectados aparecen en la interfaz.
- [ ] Los clientes desconectados desaparecen.
- [ ] Se pueden enviar mensajes individuales.
- [ ] Se pueden enviar mensajes a todos.
- [ ] Se muestran remitente, contenido y hora.
- [ ] Windows puede conectarse.
- [ ] Linux puede conectarse.
- [ ] Windows puede enviar mensajes a Linux.
- [ ] Linux puede enviar mensajes a Windows.
- [ ] El sistema funciona sin Internet.
- [ ] La aplicación puede abrirse desde otra computadora utilizando la IP LAN del servidor.
- [ ] Existe documentación para instalar y ejecutar el proyecto.

---

# 23. Funcionalidades futuras

No implementar todavía, pero diseñar el código de forma que puedan agregarse posteriormente:

- Persistencia con MySQL/PostgreSQL.
- Historial de mensajes.
- Usuarios y contraseñas.
- Grupos.
- Notificaciones de escritorio.
- Archivos adjuntos.
- Imágenes.
- Administración de usuarios.
- Mensajes no leídos.
- Confirmación de entrega.
- Confirmación de lectura.
- Aplicación de escritorio.
- Docker.
- HTTPS.
- Registro de actividad.
- Descubrimiento automático del servidor dentro de la LAN.

---

# 24. Principio principal del proyecto

La prioridad es:

```text
FUNCIONALIDAD
     ↓
SIMPLICIDAD
     ↓
CLARIDAD
     ↓
SEGURIDAD BÁSICA
     ↓
ESCALABILIDAD
```

No sobreingenierizar la primera versión.

El resultado debe ser un sistema pequeño, entendible y funcional que permita demostrar comunicación en tiempo real entre computadoras Windows y Linux conectadas a la misma red local.
