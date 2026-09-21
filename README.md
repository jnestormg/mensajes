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

Nota: basta con escribir `192.168.1.10:3000`; la app redirige sola a HTTPS sin pedir `https://`.

## Confiar el certificado (una vez por equipo)

Para que en cada computadora se carguen las notificaciones nativas sin avisos, confiar el certificado una sola vez por equipo (Windows y macOS lo hacen automáticamente; Linux sigue las instrucciones):

```bash
npm run trust
```

Es un paso único. Sin él la app igual funciona, pero el navegador pide aceptar el certificado cada vez y **no muestra notificaciones nativas** (sí las alertas internas).

Si cambia la IP del servidor, se regenera el certificado solo al arrancar; entonces repetir `npm run trust` en los equipos.

## Uso

1. Abrir la aplicación en el navegador.
2. Escribir el propio nombre y pulsar **Conectar** (cada usuario elige el suyo, no hay lista fija).
3. El nombre se **recuerda** (localStorage): al recargar la página se conecta automáticamente con ese nombre. Para usar otro, pulsar **Cambiar de nombre** en la pantalla de inicio.
4. En el panel izquierdo se muestran los clientes (conectados y desconectados).
5. Seleccionar **Todos** para enviar un mensaje global, o un cliente específico para un mensaje individual.
6. Escribir el mensaje y pulsar **Enviar** (o la tecla Enter).

## Funcionalidades

### Notificaciones

Al recibir un mensaje se activan varías alertas dentro del navegador (el botón 🔔/🔇 del encabezado silencia el sonido):

- **Sonido de alarma**: beep repetido generado con Web Audio (no requiere archivos ni Internet).
- **Aviso flotante** (toast) en la esquina superior derecha con remitente y texto.
- **Título con contador**: la pestaña muestra `(N) Mensajería LAN` y parpadea "🔴 NUEVO MENSAJE" si no está en primer plano.
- **Vibración** en navegadores móviles que lo soporten.

Estas alertas funcionan en **todas** las computadoras sin importar el certificado.

**Notificaciones nativas del sistema operativo** (popups de Windows/Linux): aparecen en **todas** las PCs cuando el certificado está confiado (`npm run trust`, una vez por equipo). En equipos donde no se confió, solo se ven las alertas internas. Al recibir el primer mensaje, la app avisa cómo activarlas.

Notas sobre el popup de Chrome:

- El popup nativo aparece en la computadora que **recibe** el mensaje, no en la que lo envía.
- Al conectar, la app pide permiso automáticamente; si está denegado, avisa cómo activarlo.
- Chrome también necesita que Windows permita las notificaciones: **Configuración de Windows > Sistema > Notificaciones > activar Chrome** (y desactivar "Asistente de enfoque"/"No molestar").

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