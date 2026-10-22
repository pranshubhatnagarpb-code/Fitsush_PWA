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
// are already-escaped HTML for each option.
export function mealOptionRowsHtml(
  foods: string[],
  leading: string[],
  trailing: string[],
  foodTd = '<td>',
): string {
  const options = foods.length ? foods : ['-'];
  const n = options.length;
  const span = (td: string) => (n > 1 ? td.replace(/^<td/, `<td rowspan="${n}"`) : td);
  const food = (html: string, i: number) =>
    `${foodTd}${n > 1 ? `<strong style="color:#FF4D06">Option ${i + 1}:</strong> ` : ''}${html}</td>`;
  return options
    .map((html, i) =>
      i === 0
        ? `<tr>${leading.map(span).join('')}${food(html, i)}${trailing.map(span).join('')}</tr>`
        : `<tr>${food(html, i)}</tr>`,
    )
    .join('');
}
