'''
Function:
    应用启动入口 —— 开发、生产与打包产物都走这里。
    桌面端形态: 启动后在默认浏览器打开界面并常驻, Ctrl+C 触发优雅停机。
'''
from __future__ import annotations

import argparse
import logging
import threading
import webbrowser

from app import __version__
from app.config import load_settings
from app.factory import create_app
from app.logging_setup import ensure_utf8_streams

logger = logging.getLogger(__name__)


def _open_browser(url: str, delay: float = 1.5) -> None:
    '''延迟打开: 等服务真的监听上了再拉浏览器, 否则用户先看到一个打不开的页面'''
    def _run() -> None:
        try:
            webbrowser.open(url)
        except Exception as exc:                                   # noqa: BLE001
            logger.debug('打开浏览器失败: %s', exc)
    threading.Timer(delay, _run).start()


def _probe(host: str, port: int) -> bool:
    """端口是否被占用(True=可绑定)。"""
    import socket
    target = '127.0.0.1' if host in {'0.0.0.0', '::'} else host
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind((target, port))
            return True
    except OSError:
        return False


def _pick_port(host: str, port: int) -> tuple[int, bool]:
    """从 port 起顺延找第一个空闲端口; 返回 (端口, 是否顺延过)。"""
    if _probe(host, port):
        return port, False
    for i in range(1, 30):
        p = port + i
        if _probe(host, p):
            return p, True
    return port, False


def main(argv: list[str] | None = None) -> int:
    # 必须先于任何 print: Windows 控制台默认 ANSI 编码, 中文 print 会直接崩进程
    ensure_utf8_streams()
    parser = argparse.ArgumentParser(description='山河回响 · 中国民族音乐曲库')
    parser.add_argument('--host', help='监听地址, 默认取 MRE_HOST(127.0.0.1)')
    parser.add_argument('--port', type=int, help='监听端口, 默认取 MRE_PORT(8766)')
    parser.add_argument('--no-browser', action='store_true', help='启动后不自动打开浏览器')
    args = parser.parse_args(argv)

    settings = load_settings()
    host = args.host or settings.host
    port = int(args.port or settings.port)

    if not args.port:
        port, shifted = _pick_port(host, port)
        if shifted:
            print(f'  端口 {settings.port} 已被其它实例占用, 自动改用 {port}', flush=True)

    app = create_app(settings)
    url = f'http://127.0.0.1:{port}' if host in {'0.0.0.0', '::'} else f'http://{host}:{port}'
    print(f'[山河回响 v{__version__}] {url}', flush=True)
    print(f'  数据目录: {settings.data_dir}', flush=True)

    if not args.no_browser:
        _open_browser(url)

    try:
        # threaded=True: 边播边下边检索; 单线程会被音频长连接占死
        app.run(host=host, port=port, threaded=True)
    except KeyboardInterrupt:
        print('\n正在退出…', flush=True)
        app.extensions['services']['lifecycle'].shutdown()
    except Exception as exc:                                        # noqa: BLE001
        # 关键: 打包成 exe 后是控制台程序, 任何未捕获异常都会让窗口一闪而过。
        # 这里统一拦下来 -> 打印原因并等待用户按键, 保证"点一下就消失"变成可读的报错。
        print(f'\n[错误] 启动失败: {type(exc).__name__}: {exc}', flush=True)
        print('\n请截图此窗口反馈。按回车键退出…', flush=True)
        try:
            input()
        except Exception:                                           # noqa: BLE001
            pass
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
