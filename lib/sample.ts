// Sample scenario — one click sets up two characters (with AI portraits),
// a Korean story, panel count, and style. Used to make the BoBi marketing
// flow demoable without manual data entry.

export interface SampleCharacterSpec {
  name: string;
  description: string;
}

export const SAMPLE_CHARACTERS: SampleCharacterSpec[] = [
  {
    name: "김지영",
    description:
      "38세 여성, 보험설계사. 단정한 단발머리(어깨 살짝 위, 검은색), 부드러운 미소, 옅은 화장. 카멜색 트렌치코트나 베이지 블라우스 등 평범한 비즈니스 캐주얼. 서류 가방을 들고 다님.",
  },
  {
    name: "박 부장",
    description:
      "47세 남성, 같은 회사 영업팀장. 짧은 단발에 살짝 흰머리가 보임. 안경을 쓰고 진중하면서도 따뜻한 표정. 네이비 셔츠나 회색 슈트 차림. 손에 종이컵 커피.",
  },
];

export const SAMPLE_STORY = `알람은 6시 30분에 맞춰 두었지만, 김지영 설계사는 5시 50분부터 깨어 있었다. 천장을 바라보며 누워 있는 동안, 어제 거절당한 미팅이 머리에서 떠나지 않았다.

'이번 달도 또 이대로 가면…'
지영은 이불을 걷어차고 일어났다. 거실로 나가니 BoBi가 모바일 화면 너머로 알림을 띄웠다.

[BoBi: 좋은 아침이에요, 지영 님. 오늘 일정 3건, 미팅 우선순위 정리해드릴까요?]

지영은 피식 웃었다. AI 비서지만, 가끔 사람보다 다정하다. 출근 준비를 마치고 지하철에 올라타며 BoBi가 뽑아준 잠재 고객 목록을 훑어본다.

회사에 도착하자 박 부장이 종이컵 커피를 들고 다가왔다.
"어제 그 건은 잘 마무리됐어?"

지영은 잠시 망설이다 솔직하게 말했다. "아니요. 또 거절당했어요."

박 부장은 잠깐 침묵하더니 옆자리 의자를 끌어 앉았다. 지영은 화제를 돌리려는 듯 조용히 물었다.
"부장님, 지호 천식은 좀 어때요?"

박 부장의 얼굴이 살짝 풀어졌다.
"덕분에 많이 좋아졌어. 보험 잘 들어놨던 게 진짜 다행이지. 지영씨 덕분이야."

지영은 자기 책상으로 돌아와 노트북을 열었다. BoBi가 자동으로 오늘의 잠재 고객 5명을 정리해 띄웠고, 각 사람의 가족 구성과 우려 사항을 한 줄씩 요약해두었다.

'그래, 한 명씩이라도. 천천히.'

화면 한쪽 구석에서 BoBi가 작은 응원의 메시지를 띄웠다.
[BoBi: 오늘도 화이팅이에요.]

지영은 키보드 위에 손가락을 올렸다. 창밖으로 들어오는 아침 햇살이 책상 위 서류를 따뜻하게 비췄다.`;

export const SAMPLE_PANEL_COUNT = 15;
export const SAMPLE_STYLE = "modern-slice-of-life";
