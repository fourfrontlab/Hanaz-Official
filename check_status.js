const token = 'gwt_Q2O6udxahAvqPTDe6Z_Stl8uRwnxOeJJ';

async function check() {
  // Check ClickUp tasks in IT Command Center
  const actsRes = await fetch('https://mcp.fastn.dev', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'fastnPlatform__listActions', arguments: { connectorId: 'adb50621-b4fb-4234-8541-95078350841b' } }
    })
  });
  const data = await actsRes.json();
  const listTasks = data.result.structuredContent.data.find(a => a.slug === 'listTasks');

  const cuRes = await fetch('https://mcp.fastn.dev', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: {
        name: 'fastnPlatform__executeAction',
        arguments: {
          connectorId: 'adb50621-b4fb-4234-8541-95078350841b',
          actionId: listTasks.id,
          connectionName: 'default',
          input: { listId: '1100360000060397', include_closed: true }
        }
      }
    })
  });
  const cuData = await cuRes.json();
  console.log('ClickUp Tasks:', JSON.stringify(cuData.result?.structuredContent?.data?.response?.tasks?.map(t => ({ id: t.id, name: t.name, status: t.status.status, text_content: t.text_content })), null, 2));

  // Check Google Sheets
  const shActs = await fetch('https://mcp.fastn.dev', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'fastnPlatform__listActions', arguments: { connectorId: '38d254e2-b92e-44f4-81cd-8251fd9373d9' } }
    })
  });
  const shData = await shActs.json();
  const getValues = shData.result.structuredContent.data.find(a => a.slug === 'getValues');

  const shRes = await fetch('https://mcp.fastn.dev', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: {
        name: 'fastnPlatform__executeAction',
        arguments: {
          connectorId: '38d254e2-b92e-44f4-81cd-8251fd9373d9',
          actionId: getValues.id,
          connectionName: 'default',
          input: { spreadsheetId: '1y0-ZimyPt0G-h4z05eYmVCycnPe5A_38vHL3uAOwZvc', range: "'ResolveSync Incidents'!A:T" }
        }
      }
    })
  });
  const shResData = await shRes.json();
  const rows = shResData.result?.structuredContent?.data?.response?.values || [];
  console.log('Total rows:', rows.length);
  console.log('Last 5 Sheet Rows:', JSON.stringify(rows.slice(-5), null, 2));
}
check();
