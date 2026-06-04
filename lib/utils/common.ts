/**
 * 对象深拷贝
 * @param obj
 */
export function deepCopy(obj) {
	if (typeof obj !== 'object' || obj === null || obj === undefined) {
		return obj;
	}

	const newObj = Array.isArray(obj) ? [] : {};

	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			newObj[key] = deepCopy(obj[key]);
		}
	}
	return newObj;
}

/**
 * 比较两个json是否相等（不考虑顺序）
 * @param json1
 * @param json2
 */
export function compareJson(json1, json2) {
	if (!json1 || !json2) {
		return json1 === json2;
	}
	if (typeof json1 === 'string') {
		json1 = JSON.parse(json1);
	}
	if (typeof json2 === 'string') {
		json2 = JSON.parse(json2);
	}
	if (Object.keys(json1).length !== Object.keys(json2).length) {
		return false;
	}
	for (const key in json1) {
		if (Object.prototype.hasOwnProperty.call(json1, key)) {
			if (typeof json1[key] === 'object' && typeof json2[key] === 'object') {
				if (!compareJson(json1[key], json2[key])) {
					return false;
				}
			} else if (json1[key] !== json2[key]) {
				return false;
			}
		}
	}
	return true;
}

/**
 *
 * @param t 时间, mills
 * @returns YYYY-MM-DD HH:mm:ss
 */
export function formatDateTime(t: number): string {
	if (!t || isNaN(t)) {
		return ''
	}
	const date: Date = new Date(t)
	let month = date.getMonth() + 1
	if ( month < 10){
		month = "0" + month
	} 
	let day = date.getDate()
	if (day < 10){
		day = "0" + day
	}
	let hours = date.getHours()
	if (hours < 10){
		hours = "0" + hours
	}
	let minutes = date.getMinutes()
	if (minutes < 10){
		minutes = "0" + minutes
	}
	let seconds = date.getSeconds()
	if (seconds < 10){
		seconds = "0" + seconds
	}
	return (
		date.getFullYear() + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds
	)
}

export function isTableCellEmpty(value: unknown): boolean {
	if (value == null || value === '') return true
	if (Array.isArray(value) && value.length === 0) return true
	return false
}

export function formatTableCell(value: unknown): string {
	return isTableCellEmpty(value) ? '-' : String(value)
}

export function getOutlineItems(
	outline: string[] | string | undefined | null
): string[] {
	if (Array.isArray(outline)) return outline
	if (typeof outline === 'string' && outline.trim()) return [outline]
	return []
}

export function getOutlineDisplay(
	outline: string[] | string | undefined | null
): string {
	const items = getOutlineItems(outline)
	if (items.length === 0) return '-'
	if (items.length <= 3) {
		return items.join(' | ')
	}
	return `${items.slice(0, 3).join(', ')}... (+${items.length - 3}项)`
}

/**
 * RGB 颜色值转换为 十六进制颜色值.
 * r, g, 和 b 需要在 [0, 255] 范围内
 *
 * @return  String          类似#ff00ff
 * @param r
 * @param g
 * @param b
 */
export function rgbToHex(r: number, g: number, b: number) {
	// tslint:disable-next-line:no-bitwise
	const hex = ((r << 16) | (g << 8) | b).toString(16);
	return '#' + new Array(Math.abs(hex.length - 7)).join('0') + hex;
}
  