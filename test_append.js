const token = 'gwt_Q2O6udxahAvqPTDe6Z_Stl8uRwnxOeJJ';

async function test() {
  const shActs = await fetch('https://mcp.fastn.dev', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'fastnPlatform__listActions', arguments: { connectorId: '38d254e2-b92e-44f4-81cd-8251fd9373d9' } }
    })
  });
  const shData = await shActs.json();
  const appendValues = shData.result.structuredContent.data.find(a => a.slug === 'appendValues');

  const res = await fetch('https://mcp.fastn.dev', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: {
        name: 'fastnPlatform__executeAction',
        arguments: {
          connectorId: '38d254e2-b92e-44f4-81cd-8251fd9373d9',
          actionId: appendValues.id,
          connectionName: 'default',
          input: {
            spreadsheetId: '1y0-ZimyPt0G-h4z05eYmVCycnPe5A_38vHL3uAOwZvc',
            range: "'ResolveSync Incidents'!A:T",
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            values: [['test1', 'test2']]
          }
        }
      }
    })
  });
  const d = await res.json();
  console.log('Append result:', JSON.stringify(d, null, 2));
}
test();
