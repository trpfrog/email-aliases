/** フォームのテキスト項目を読む。ファイルや未入力の項目は空文字として扱う。 */
export function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
