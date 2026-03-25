const fs = require('fs');

const files = [
  'src/pages/CompanyPerformance.tsx',
  'src/pages/TeamPerformance.tsx',
  'src/pages/HRMap.tsx',
  'src/pages/EmployeeDashboard.tsx',
  'src/components/Sidebar.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Find <button tag and its attributes up to >. If it doesn't contain onClick or type="submit", add onClick.
  content = content.replace(/<button([^>]*?)>/g, (match, p1) => {
    if (p1.includes('onClick') || p1.includes('type="submit"') || p1.includes('disabled')) {
      return match;
    }
    return `<button onClick={() => alert("功能开发中")}${p1}>`;
  });

  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed', file);
}
