import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { RoomInfo } from './room-ws.entity';
@WebSocketGateway(3131, {
  cors: { origin: '*' },
})
export class WsAdapter implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection() {}

  handleDisconnect() {}

  private roomInfo: RoomInfo[] = [];

  @SubscribeMessage('createRoom')
  async createRoom(socket: Socket, payload) {
    socket.join(payload.roomName);
    console.log(socket.rooms);

    this.roomInfo.push({
      createUser: payload.userName,
      roomName: payload.roomName,
      roomState: 'waiting',
    });

    socket.emit('createRoom', {
      createUser: payload.userName,
      roomName: payload.roomName,
      roomState: 'waiting',
    });
  }

  @SubscribeMessage('roomListAll')
  async roomList(socket: Socket) {
    socket.emit('roomListAll', this.roomInfo);
  }
}
