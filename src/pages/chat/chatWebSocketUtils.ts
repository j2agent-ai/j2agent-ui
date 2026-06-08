/** 拆除 WebSocket 回调并关闭连接，避免旧连接晚到的包被错误处理。 */
export const detachWebSocket = (ws: WebSocket | undefined) => {
	if (!ws) {
		return
	}
	try {
		ws.onopen = null
		ws.onmessage = null
		ws.onerror = null
		ws.onclose = null
	} catch {
		/* ignore */
	}
	try {
		if (
			ws.readyState === WebSocket.OPEN ||
			ws.readyState === WebSocket.CONNECTING
		) {
			ws.close()
		}
	} catch {
		/* ignore */
	}
}
