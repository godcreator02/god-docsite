// 站点上下文：功能包的 loader/action 经参数拿到它，功能包自己不 import 站点代码。
// react-router dev 与 react-router-serve 都在站点目录里启动，cwd 就是站点目录
export const site = {
  dir: process.cwd(),
};
