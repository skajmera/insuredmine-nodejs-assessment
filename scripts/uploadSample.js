const fs = require('fs');
const path = require('path');

async function main() {
  const filePath = path.resolve(__dirname, '../sample-data/policy-data.csv');
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)]), 'policy-data.csv');

  const res = await fetch('http://localhost:4000/api/upload', {
    method: 'POST',
    body: form,
  });

  console.log(await res.json());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
