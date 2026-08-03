import { Component, type ErrorInfo, type ReactNode } from 'react';

interface PageErrorBoundaryProps { children: ReactNode; resetKey: string }
interface PageErrorBoundaryState { error: Error | null }

export default class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(previousProps: PageErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('页面渲染异常', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-6 rounded-lg border border-red-200 bg-white p-6 text-sm text-gray-700">
        <h2 className="text-base font-semibold text-gray-900">当前页面加载失败</h2>
        <p className="mt-2 text-gray-500">页面数据可能暂时不可用。你可以返回上一页，或重新加载后再试。</p>
        <div className="mt-4 flex gap-2">
          <button className="ui-btn" onClick={() => window.history.back()}>返回上一页</button>
          <button className="ui-btn ui-btn-primary" onClick={() => window.location.reload()}>重新加载</button>
        </div>
      </div>
    );
  }
}
