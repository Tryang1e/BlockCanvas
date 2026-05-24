const fs = require('fs');
const file = 'src/components/creator/BusinessCardContact.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

lines[319] = '                <span className="bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full border border-white/20">추후 배경 이미지 편집 기능 제공 예정</span>';
lines[380] = '                        클립보드에 복사되었습니다!                      </div>';
lines[393] = '                    title="디스코드 ID 복사하기"';
lines[405] = '                          클립보드에 복사되었습니다!                        </div>';

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Fixed texts successfully.');
