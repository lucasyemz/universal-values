import { useLocale } from "next-intl";
import { createText, productLocale } from "./text";
export function useText() { return createText(productLocale(useLocale())); }
