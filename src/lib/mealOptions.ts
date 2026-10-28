// Multiple main-meal options per meal time.
//
// AI plans (ai_plan_data.dayGroups[].meals[]): `foodPlan` is option 1 and
// `moreOptions` holds options 2..N. Plans saved before this existed simply have
// no `moreOptions`, so they read as a single option.

export function mealFoodOptions(meal: { foodPlan?: string; moreOptions?: string[] } | null | undefined): string[] {
  return [meal?.foodPlan, ...(meal?.moreOptions ?? [])]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
}

// Renders one meal as table rows: one row per option, with the other cells
// spanning all of them. `leading`/`trailing` are full `<td>` strings; `foods`
// are already-escaped HTML for each option. `groupIndex` (the meal's position
// in the table) shades every other meal as a whole; see DIET_TABLE_CSS.
export function mealOptionRowsHtml(
  foods: string[],
  leading: string[],
  trailing: string[],
  foodTd = '<td>',
  groupIndex = 0,
): string {
  const options = foods.length ? foods : ['-'];
  const n = options.length;
  const span = (td: string) => (n > 1 ? td.replace(/^<td/, `<td rowspan="${n}"`) : td);
  const food = (html: string, i: number) =>
    `${foodTd}${n > 1 ? `<strong class="opt-label" style="color:#FF4D06">Option ${i + 1}:</strong> ` : ''}${html}</td>`;
  const alt = groupIndex % 2 === 1 ? ' meal-alt' : '';
  return options
    .map((html, i) =>
      i === 0
        ? `<tr class="meal-first${alt}">${leading.map(span).join('')}${food(html, i)}${trailing.map(span).join('')}</tr>`
        : `<tr class="meal-opt${alt}">${food(html, i)}</tr>`,
    )
    .join('');
}

// Table rules for the diet chart, appended last in each chart's <style>.
// Every cell gets a visible border (thin light lines drop out unevenly when
// printed), each meal time starts with an orange rule, and shading goes per
// meal rather than per row, so a meal's options read as one block.
export const DIET_TABLE_CSS = `
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    table{font-size:15px;line-height:1.5}
    td{border:1px solid #cfcfcf;padding:9px 12px;vertical-align:top}
    th{padding:10px 12px;border:1px solid #FF4D06}
    tr:nth-child(even),tbody tr:nth-child(even){background:transparent}
    tr.meal-first>td{border-top:2px solid #FF4D06}
    tr.meal-alt>td{background:#fff6f0}
    .opt-label{white-space:nowrap}`;
