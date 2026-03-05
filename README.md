# mppaint 🎨

**Multiplayer collaborative canvas** - Draw together in real-time with P2P WebRTC.

## Features

- **No server needed** - Uses BitTorrent DHT for peer discovery via [Trystero](https://github.com/dmotz/trystero)
- **Real-time sync** - [Yjs](https://yjs.dev/) CRDT ensures conflict-free collaboration
- **Simple lobby** - Create a room, share the link, draw together
- **Touch support** - Works on mobile and tablets
- **Zero sign-up** - Just open the link and start drawing

## Try it

[https://svenflow.github.io/mppaint/](https://svenflow.github.io/mppaint/)

## How it works

1. **Room Creation**: Generate a 6-character room code
2. **Peer Discovery**: Trystero uses BitTorrent DHT to find other peers in the same room
3. **WebRTC Connection**: Direct P2P connection established between browsers
4. **Canvas Sync**: Drawing commands synced via Yjs CRDT for eventual consistency

## Tech Stack

- React + TypeScript + Vite
- [Trystero](https://github.com/dmotz/trystero) - Serverless WebRTC rooms via BitTorrent
- [Yjs](https://yjs.dev/) - CRDT for real-time collaboration
- GitHub Pages hosting

## Development

```bash
npm install
npm run dev
```

## License

MIT
