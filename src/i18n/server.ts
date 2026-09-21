import { getLocale } from "next-intl/server";
import { createText, productLocale } from "./text";
export async function getText() { return createText(productLocale(await getLocale())); }
