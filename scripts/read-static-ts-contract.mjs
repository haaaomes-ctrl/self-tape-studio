import fs from 'node:fs';
import ts from 'typescript';

export function readStaticExportedConstObject({ filePath, exportName }) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  let decl = null;
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) continue;
    for (const d of stmt.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === exportName) decl = d;
    }
  }

  if (!decl) {
    throw new Error(JSON.stringify({ code: 'missing_export', filePath, exportName }));
  }

  return evalStatic(decl.initializer, { filePath, exportName });
}

function evalStatic(node, ctx) {
  if (!node) throw new Error(JSON.stringify({ code: 'missing_initializer', ...ctx }));

  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isParenthesizedExpression(node)) {
    return evalStatic(node.expression, ctx);
  }

  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) {
        throw new Error(JSON.stringify({ code: 'unsupported_object_property', ...ctx }));
      }
      let key;
      if (ts.isShorthandPropertyAssignment(prop)) {
        throw new Error(JSON.stringify({ code: 'unsupported_shorthand_property', ...ctx, property: prop.name.getText() }));
      }
      if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) key = prop.name.text;
      else throw new Error(JSON.stringify({ code: 'unsupported_property_name', ...ctx }));
      out[key] = evalStatic(prop.initializer, ctx);
    }
    return out;
  }

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((el) => evalStatic(el, ctx));
  }

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;

  throw new Error(JSON.stringify({ code: 'unsupported_expression', ...ctx, kind: ts.SyntaxKind[node.kind] }));
}
