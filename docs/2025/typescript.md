# typescript 使用

## 类型继承与交叉类型

```ts
const myConst = {
  foo: 'value1',
  bar: 'value2',
  baz: 'value3',
} as const;

type MyConstType = typeof myConst;

// 组合新的 interface
interface NewInterface extends MyConstType {
  value: string;
}

// 示例：
const example: NewInterface = {
  foo: 'value1',
  bar: 'value2',
  baz: 'value3',
  value: 'finalValue',
};
```
