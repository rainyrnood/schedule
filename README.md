# 일정관리 (Schedule)

브라우저에서 동작하는 개인용 일정/Task 관리 정적 웹앱. 데이터는 브라우저 localStorage에 저장되며 별도 서버가 필요 없습니다.

라이브: https://rainyrnood.github.io/schedule/

## 기능
- 일정관리 대시보드: 전체/오늘 Task, 예상 업무시간, 기한 초과, 완료 현황
- 캘린더(월/주/목록): Task 배치, 드래그 이동, 주간 접기/펼치기, 마감 마커
- 자동 배치: 미배정 Task를 가용 시간에 자동 스케줄링
- Task 목록, 차트, 주간 요약
- 우선순위(높음/보통/낮음/없음)별 색상 구분, ICS 내보내기

## 구성
- `index.html` — 진입점
- `css/` — base, dashboard, tasklist, calendar, chart, weekly
- `js/` — app, calendar, dashboard, tasklist, ui, utils, data, ics, chart-*

## 사용
저장소를 클론하거나 `index.html`을 브라우저로 열면 됩니다. 외부 의존성은 CDN의 FullCalendar뿐입니다.
