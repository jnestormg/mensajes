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
2. Escribir el nombre de la computadora y pulsar **Conectar**.
3. En el panel izquierdo se muestran los clientes conectados.
4. Seleccionar **Todos** para enviar un mensaje global, o un cliente específico para un mensaje individual.
5. Escribir el mensaje y pulsar **Enviar** (o la tecla Enter).

## Endpoints

| Método | Ruta            | Descripción                          |
| ------ | --------------- | ------------------------------------ |
| GET    | `/`             | Sirve la aplicación web              |
| GET    | `/api/health`   | Estado del servidor                  |
| GET    | `/api/clients`  | Lista de clientes conectados         |

## Notas

- Los mensajes se guardan solo en memoria mientras el servidor esté ejecutándose. Si el servidor se reinicia, se pierden.
- No se requiere Internet; la comunicación ocurre exclusivamente dentro de la red local.