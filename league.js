export const normalise = value => String(value ?? '').trim();
export const key = value => normalise(value).toLocaleLowerCase('en');
export const slug = value => key(value).replace(/\s+/g, '-');
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function parseCSV(text) {
  if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('The published sheet is too large to load.');
  if (/^\s*</.test(text)) throw new Error('A spreadsheet link returned a page instead of CSV. Check its publishing settings.');
  const rows=[]; let row=[],cell='',quoted=false;
  const source=text.replace(/^\uFEFF/,'');
  const finishRow=()=>{row.push(cell);if(row.some(v=>normalise(v)))rows.push(row);row=[];cell='';};
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(ch==='"'){
      if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
    }else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\r'||ch==='\n')&&!quoted){if(ch==='\r'&&source[i+1]==='\n')i++;finishRow();}
    else cell+=ch;
  }
  if(quoted)throw new Error('The published CSV contains an unfinished quoted cell.');
  if(cell||row.length)finishRow();
  return rows;
}
