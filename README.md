# Pixel Snap Tool

AI로 생성한 이미지를 **anchor(기준점) + 최소 픽셀 크기** 규칙으로 정렬해, 픽셀 그리드가 딱 맞는 결과를 만드는 간단한 웹 툴입니다.

## 핵심 기능

- 로컬 이미지 파일 업로드
- 최소 픽셀 크기 지정 (예: 4px, 6px, 8px)
- 캔버스 클릭으로 anchor 지정
- anchor를 기준으로 전체 이미지 pixel snap 적용
- 결과 PNG 다운로드

> 참고 아이디어: `spritefusion-pixel-snapper`

## 실행

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173` 열기.

## 사용 흐름

1. 이미지 업로드
2. 픽셀 크기 입력
3. 캔버스 클릭으로 anchor 설정
4. `Pixel Snap 적용`
5. 필요시 `PNG 다운로드`

## 테스트 가이드 (첨부 이미지)

대화에 첨부한 이미지를 저장한 뒤 업로드해서 다음 값으로 확인해보세요.

- 픽셀 크기: `6`
- anchor 후보:
  - 중앙 (`width/2`, `height/2`)
  - 눈동자 윤곽선 위 포인트
  - 배경과 캐릭터 경계선 위 포인트

anchor를 바꾸면 동일한 픽셀 크기에서도 경계선 정렬 결과가 달라집니다.
