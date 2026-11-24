# contest-film-pipeline (공모전 AI 영상·이미지 출품 파이프라인)

[![test](https://github.com/reedodev/contest-film-pipeline/actions/workflows/test.yml/badge.svg)](https://github.com/reedodev/contest-film-pipeline/actions/workflows/test.yml)
[English README](README.md)

**AI 영상·AI 이미지 공모전**에 낼 때, 규정 읽기부터 제출 버튼까지 따라가는 에이전트 스킬(Claude Code·Aside용 `SKILL.md`)입니다. 실제로 출품하면서 틀린 것들로 만들었습니다.

2026년 11월에 공모전용 AI 단편 9편과 AI 이미지 4건을 만들었습니다. 그 과정에서 프리비즈의 회색 상자가 완성본에 그대로 나오고, 냄비가 공중에 뜨고, 30초 영상이 유튜브에서 **0:31**로 표시되고, 편집 경계에 0.3초짜리 다른 컷이 끼어들었습니다. "무슨 영상인지 모르겠다", "대화가 많이 있어야지"라는 지적도 받았습니다. 그 하나하나를 교훈 표의 한 줄과 점검표의 한 칸으로 만들었고, 그중 세 가지는 스크립트가 됐습니다.

## 들어 있는 것

```
skills/contest-film-pipeline/
  SKILL.md                     11단계 절차 (규정 → 대본 → 시트 → 프리비즈 → 프롬프트 → 생성 →
                               후반 → 검수 → 제출 → 공개 게시 → 교훈 갱신)
  references/lessons.md        교훈 72줄: 증상 → 원인(확인/미확인) → 고친 방법 → 규칙
  references/checklists.md     기획·생성 전·생성 직후·제출 전·제출 폼·게시·작업 끝 점검표
  scripts/duration-check.mjs   컨테이너·영상·소리·마지막 패킷 끝이 모두 규정 길이 안인지
  scripts/short-cut-check.mjs  0.5초 미만 짧은 컷(편집 경계에 끼어든 프레임) 찾기 (ffmpeg scdet)
  scripts/scene-sheet.mjs      1초 장면표(시각이 찍힌 타일 그림) + 초마다 채우는 검수표
```

## 처음 오셨나요? 3분 안내

**준비물:** Node.js 18 이상, ffmpeg·ffprobe(명령창에서 `ffmpeg -version`이 되면 됩니다. 다른 위치에 있으면 `FFMPEG`, `FFPROBE` 환경 변수로 경로를 알려 주세요).

```bash
git clone https://github.com/reedodev/contest-film-pipeline
cd contest-film-pipeline/skills/contest-film-pipeline     # 아래 명령은 이 폴더에서 실행합니다

node scripts/duration-check.mjs 최종본.mp4 --max 30        # 30초 규정 → 모든 흐름 29.95초 이하
node scripts/short-cut-check.mjs 최종본.mp4 --min 0.5     # 0.5초 미만 컷
node scripts/scene-sheet.mjs 최종본.mp4 --out qa/scenes    # sheet_01.jpg … + scenes.md
```

결과 코드: `0` 통과, `1` 불합격, `2` 사용법·ffmpeg 오류.

**스킬로 쓰기:** `skills/contest-film-pipeline` 폴더를 에이전트의 스킬 폴더(Claude Code는 `~/.claude/skills/`)에 복사하거나, 이 저장소를 플러그인 마켓플레이스로 추가하세요. 그다음 "이 공모전 영상 출품 준비해 줘"처럼 말하면 됩니다.

| 용어 | 뜻 |
|---|---|
| 프리비즈 | 회색 도형으로 카메라·동선만 미리 잡아 보는 간단한 3D 영상 |
| 시트 | 인물·장소를 여러 각도로 한 장에 모은 기준 그림 |
| 슬롯 장부 | 한 계정의 무제한 생성 자리를 누가 쓰는지 적는 한 칸짜리 기록 |
| 1초 장면표 | 영상을 1초마다 한 장씩 뽑아 타일로 붙인 검수용 그림 |
| 처음 보는 사람 검수 | 대본을 모르는 검수자에게 장면표만 보여 주고 "무슨 이야기인지, 이상한 곳 전부"를 묻는 검수 |

| 막혔을 때 | 해 볼 것 |
|---|---|
| `ffprobe could not start` | ffmpeg 설치 또는 `FFMPEG`/`FFPROBE` 경로 지정 |
| 장면표에 시각 글자가 없음 | ffmpeg가 기본 글꼴을 못 찾은 것. `--font 글꼴.ttf` |
| 컷이 너무 많이 잡힘 | 번쩍임·빠른 움직임 때문. `--threshold 14`처럼 올리고 걸린 시각은 눈으로 확인 |

## 가장 중요한 교훈

- **대화 중심, 처음 설명.** 첫 3~5초에 누가 무엇을 왜 찾는지 알려 줍니다. 대사형은 30초마다 대사 6~9줄, 행동의 이유는 대사로.
- **프리비즈 영상을 영상 모델에 넣지 않습니다.** 회색 도형을 따라 그립니다. 카메라 수치를 글로 씁니다.
- **참조 그림 속 물건이 따라 나옵니다.** 장소 그림의 보온 통이 「상자 금지」 문장에도 계속 나왔습니다. 참조 그림에서 잘라 냅니다.
- **3초 단위 프롬프트**(샷·카메라·렌즈·움직임·어느 손에 무엇·빛·대사·효과음) + 칸 사이 연결 문장.
- **무제한 생성은 계정당 한 번에 1건.** 겹치면 실패가 쌓이고 유료 사용 안내가 뜹니다. 슬롯 장부로 순서를 정합니다.
- **처음 보는 사람 검수**에서 「꼭 고칠 것」 0건일 때만 통과, 그다음 사람이 「제출해」.
- **제출 폼 함정:** 100자 칸, 연락처 맨 앞 0 사라짐, 응답 수정 불가, 결과 발표 전 공개 금지 조건.

## 시험

```bash
node tests/run.mjs
```

`SKILL.md` 형식·링크 검사, 모든 파일의 개인정보 패턴 검사, 단위 시험, (ffmpeg가 있으면) 만든 영상으로 실제 검사까지 합니다. GitHub Actions에서도 같은 시험이 돕니다.

## 출처와 영감

- 교훈은 모두 제 공모전 작업 기록에서 뽑았습니다.
- 에셋 줄 4칸·장소 에셋 쓰는 법: arca.live AI 실사 채널 글 「장소나 공간 에셋으로 연출하는 팁 — Seedance」(https://arca.live/b/aireal/189257143). 글은 옮기지 않고 아이디어만 썼습니다.
- 인물 시트 3단계(Face Lock → 전신 → 시트): @pounddz의 X 글 「How to Make Better AI Ads Than 99% of People」(https://x.com/pounddz/status/2124609892572864858). 아이디어만 썼습니다.
- 짧은 컷 검사는 ffmpeg의 `scdet` 필터를 씁니다(ffmpeg는 저장소에 넣지 않았습니다).

## 라이선스

MIT
