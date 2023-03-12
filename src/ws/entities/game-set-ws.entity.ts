export class GameSetWsEntity {
  roomNumber: number;
  userInfo: Array<object>;
  userList: Array<string>;
}

/*
* // room Info
* {
    roomNumber: '6',
    userInfo: [ [Object], [Object] ],
    userList: [ 6124, 6474 ]
  }

*
* // userInfo
* {
    socId: '70DpPtWSBnAGm5D7AAAR',
    userId: 6124,
    userName: 'test6124',
    userState: 'ready',
    userRole: 'host'
  },
* */
