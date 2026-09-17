# Mensajería LAN

Sistema de mensajería en tiempo real entre computadoras conectadas a la misma red local (LAN). Funciona con computadoras Windows y Linux sin depender de Internet.

## Requisitos

- Node.js
- npm

## Instalación

```bash
npm install
```

## Configuración

Crear un archivo `.env` (opcional). Copiar desde `.env.example`:

```env
PORT=3000
HOST=0.0.0.0
```

- `PORT`: puerto del servidor (por defecto `3000`).
- `HOST`: dirección donde escucha (por defecto `0.0.0.0`, todas las interfaces).

## Desarrollo

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

## Uso

1. Abrir la aplicación en el navegador.
2. La primera vez pide el nombre de esta computadora y pulsar **Conectar**.
3. El nombre se **recuerda** (localStorage): al recargar la página se conecta automáticamente. Para usar otro nombre, pulsar **Cambiar de computadora** en la pantalla de inicio.
4. En el panel izquierdo se muestran los clientes (conectados y desconectados).
5. Seleccionar **Todos** para enviar un mensaje global, o un cliente específico para un mensaje individual.
6. Escribir el mensaje y pulsar **Enviar** (o la tecla Enter).

## Funcionalidades

### Notificaciones muy notorias (en el navegador)

Al recibir un mensaje se activan varias alertas (el botón 🔔/🔇 del encabezado silencia el sonido):

- **Sonido de alarma**: beep repetido generado con Web Audio (no requiere archivos ni Internet).
- **Aviso flotante** (toast) en la esquina superior derecha con remitente y texto.
- **Título con contador**: la pestaña muestra `(N) Mensajería LAN` y parpadea "🔴 NUEVO MENSAJE" si no está en primer plano.
- **Pantalla de alerta a pantalla completa** con fondo rojo parpadeante cuando el mensaje llega a una conversación que no está abierta.
- Si el navegador lo permite (HTTPS o `localhost`), también se muestra una notificación nativa del sistema operativo.

Nota: por `http://` más IP de LAN, los navegadores bloquean las notificaciones nativas del sistema operativo; por eso las alertas se muestran dentro del navegador.

### Conversaciones separadas

Cada cliente y **Todos** tienen su propia conversación e historial. Los mensajes privados solo aparecen en la conversación con ese cliente, y los globales solo en **Todos**. Las conversaciones con mensajes sin leer muestran un contador rojo.

### Entrega de mensajes a clientes desconectados

- Los clientes que se desconectaron siguen visibles en el panel (marcados como **desconectado**).
- Si envías un mensaje a uno de ellos, el servidor lo **guarda en memoria** y lo entrega automáticamente cuando vuelve a conectarse.
- El remitente ve el mensaje marcado como **pendiente**.
- Los mensajes globales no se guardan; solo se entregan a los clientes conectados en el momento del envío.

### Historial guardado en cada computadora

Cada navegador guarda su propio historial de chat en `localStorage` (clave `lan-history-v1`):

- Al recargar la página, la conversación se restaura al instante.
- Los mensajes se guardan con escritura diferida (no afecta el rendimiento) y se limpian los mensajes del sistema (conectado/desconectado/errores).
- Límite de ~300 mensajes por conversación y 30 conversaciones; los más antiguos se descartan.
- Si tienes dos pestañas abiertas del mismo navegador, el historial se sincroniza entre ellas automáticamente.
- El historial es **por computadora/navegador**, no se comparte entre PCs ni se pierde al reiniciar el servidor (pero los mensajes pendientes de entrega sí se pierden si el servidor se reinicia antes de que el destino se conecte).

### PWA (instalable como aplicación)

La app es una Aplicación Web Progresiva (PWA), instalable como programa nativo **solo desde `localhost`** (los navegadores exigen HTTPS o `localhost`):

- Abrir `http://localhost:3000`, pulsar el botón **📥 Instalar** (o usar la opción del navegador).
- Desde la LAN (`http://IP:3000`) no se puede instalar ni registrar el service worker por la política de HTTPS de los navegadores; la app funciona igual, con alertas dentro del navegador.
- El service worker guarda la app en caché: con la app instalada puede abrirse aunque el servidor esté apagado (el chat necesitará el servidor para reconectar).
- En `localhost` también se activan las notificaciones nativas del sistema operativo.
- Para regenerar los iconos: `npm run icons`.

## Endpoints

| Método | Ruta            | Descripción                          |
| ------ | --------------- | ------------------------------------ |
| GET    | `/`             | Sirve la aplicación web              |
| GET    | `/api/health`   | Estado del servidor                  |
| GET    | `/api/clients`  | Lista de clientes conocidos (conectados y desconectados) |

## Notas

- Los mensajes se guardan solo en memoria mientras el servidor esté ejecutándose. Si el servidor se reinicia, se pierden.
- No se requiere Internet; la comunicación ocurre exclusivamente dentro de la red local.