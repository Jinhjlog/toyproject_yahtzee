export class GamePlayWsEntity {
  roomNumber: number;
  userPlayInfo: Array<object>;
  // {
  //   userId: user_id
  //   userName: user_name
  //   userScore: 유저 점수: 총 합 점수를 넣는다.
  // }
  userDiceTurn: Array<string>;
  //userDiceInfo: Array<object>;
  // {
  //   userId: user_id
  //   diceCount: 3 // 남은 주사위 횟수
  //   diceTurn: false, true // 주사위 턴 구분
  // }

  userYahtScore: Array<object>;
  // {
  //    userId: user_id
  //    야찌 점수별로 다 나열 해야함
  //    ones : 주사위 눈금에 "1" 있는 주사위들의 눈금 합만큼 점수가 오릅니다.
  //    twos : 주사위 눈금에 "2" 있는 주사위들의 눈금 합만큼 점수가 오릅니다.
  //    threes : 주사위 눈금에 "3" 있는 주사위들의 눈금 합만큼 점수가 오릅니다.
  //    fours : 주사위 눈금에 "4" 있는 주사위들의 눈금 합만큼 점수가 오릅니다.
  //    fives : 주사위 눈금에 "5" 있는 주사위들의 눈금 합만큼 점수가 오릅니다.
  //    sixes : 주사위 눈금에 "6" 있는 주사위들의 눈금 합만큼 점수가 오릅니다.
  //    bonus : 위의 6개 항목에서 얻은 총점이 63점을 넘으면, 추가 보너스 35점이 추가됩니다.
  //
  //    triple : 같은 숫자가 3개 있으면, 주사위 눈금 전체의 합만큼 점수가 추가됩니다.
  //    four card : 같은 숫자가 4개 있으면, 주사위 눈금 전체의 합만큼 점수가 추가됩니다.
  //    full house :  눈이 동일한 주사위가 각각 3개 2개 있을 때 고정 점수 25점을 얻습니다. (ex : 5개중 주사위 3이 2개 주사위 2가 3개 일 경우)
  //    small straight : 1-2-3-4, 2-3-4-5, 3-4-5-6 이 있을 경우, 고정 점수 35점을 받습니다.
  //    large straight : 1-2-3-4-5, 2-3-4-5-6 일 경우, 고정 점수 40점을 받습니다.
  //    yhance : 모든 눈의 합만큼 점수를 받습니다.
  //    yahtzee : 모든 눈이 같을 경우, 고정 점수 50점을 받습니다.
  //    yahtzee bonus : 야찌가 또 나올경우, 100점 추가
  // }
  gameRound: number;
  userDiceSet: object;
}
