import fs from 'fs';
import path from 'path';

export function saveMarkdown(brief, config) {
  const outputDir = config.delivery?.outputDir || './briefs';
  fs.mkdirSync(outputDir, { recursive: true });

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `brief-${dateStr}.md`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, brief, 'utf8');
  console.log(`Brief saved to ${filepath}`);
  return filepath;
}
