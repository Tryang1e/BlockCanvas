# tools/

웹앱이 런타임에 **별도 프로세스로 호출**하는 외부 도구를 두는 곳. (별도 프로세스 호출이므로 GPL 도구라도 웹앱 라이선스에 전염되지 않음.)

## SchemConvert.jar — `.schem ↔ .bp(Axiom 블루프린트)` 변환기

스키매틱 클라우드의 `.schem ↔ .bp` 변환이 이 jar를 사용합니다(`src/lib/schematicConvert.ts` → `java -jar tools/SchemConvert.jar --input <in> --output <out>`).

- **출처**: https://github.com/PiTheGuy/SchemConvert (GPL-3.0)
- **버전**: v1.2.5 (`SchemConvert-1.2.5-all.jar`, 의존성 번들 포함)
- **요구**: Java 21+ (이 서버는 PATH의 Java 21 + `MC_SER/Server/jdk-25` 보유)
- **포맷**: `.schem`(Sponge/WorldEdit) · `.bp`(Axiom) · `.litematic` · `.nbt` 상호 변환. `.bp`는 read/write 양방향 지원(`AxiomSchematicFormat`, magic `0x0AE5BB36`).

### 재배치/재설치 방법

`*.jar`는 gitignore(3rd-party 바이너리 비커밋)이므로, 새 머신에 배포 시 직접 받아 이 폴더에 둡니다:

```bash
curl -L -o tools/SchemConvert.jar \
  https://github.com/PiTheGuy/SchemConvert/releases/download/v1.2.5/SchemConvert-1.2.5-all.jar
```

### env 오버라이드 (선택)

- `SCHEMCONVERT_JAR` — jar 절대경로 (기본 `<cwd>/tools/SchemConvert.jar`)
- `JAVA_BIN` — java 실행파일 경로 (기본 PATH의 `java`; 예 `MC_SER/Server/jdk-25/bin/java.exe`)
