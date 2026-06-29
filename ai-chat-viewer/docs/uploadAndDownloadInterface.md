# 文件上传下载接口

## 1. 文件上传接口

### 调用方

UI层调用

### 接口说明

上传文件

### 接口名

```typescript
window.Pedestal.callMethod('method://agentSkillsDialog/uploadFile', {
  fileName: '',
  filePath: '',
  uploadId: '',
  onProgress: (percent: number, uploadId: string) => {}
});
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| fileName | String | 是 | 文件名称 |
| filePath | String | 是 | 文件路径 |
| uploadId | String | 否 | 文件上传任务ID |
| onProgress | Function | 否 | 文件上传进度回调函数 |

### 出参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| success | String | 是 | 是否成功 |
| uploadId | String | 否 | 文件上传任务ID |
| umLink | String | 否 | UM链接字符串 |
| umUrl | Function | 否 | 外链URL |
| umPlainAccessCode | String | 否 | 外链访问码 |
| error | String | 否 | 错误信息 |

### 调用示例

```typescript
try {
  const uploadResult = await window.Pedestal.callMethod('method://agentSkillsDialog/uploadFile',{
    fileName: '',
    filePath: '',
    uploadId: '',
    onProgress: (percent: number,uploadId: string) => {
        console.log(percent);
    }
  });
} catch (error) {
  //
}
```

## 2. 文件下载接口

### 调用方

UI层调用

### 接口说明

下载文件

### 接口名

```typescript
window.Pedestal.callMethod('method://agentSkillsDialog/downloadFile', {
  umLink: '',
  filePath: '',
  downLoadId: '',
  onProgress: (percent: number, uploadId: string) => {}
});
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| umLink | String | 是 | UM链接字符串 |
| filePath | String | 否 | 文件保存路径 |
| downLoadId | String | 否 | 文件上传任务ID |
| onProgress | Function | 否 | 文件下载进度回调函数 |

### 出参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| success | String | 是 | 是否成功 |
| uploadId | String | 否 | 文件上传任务ID |
| filePath | String | 否 | 文件保存路径 |
| error | String | 否 | 错误信息 |

### 调用示例

```typescript
try {
  const uploadResult = await window.Pedestal.callMethod('method://agentSkillsDialog/downLoadFile',{
    umLink: '',
    filePath: '',
    downLoadId: '',
    onProgress: (percent: number,uploadId: string) => {
        console.log(percent);
    }
  });
} catch (error) {
  //
}
```

## 3. 打开文件选择弹窗

### 调用方

UI层调用

### 接口说明

打开文件选择弹窗，支持用户选择文件

### 接口名

```typescript
window.Pedestal.remote.dialog.showOpenDialog({
  title: '选择文件',
  properties: ['openFile'],
  filters: [{{name: '支持的文件',extensions: ['doc','docx','ppt','pptx','xls','xlsx','txt','pdf','jpg','jpeg','png','msg','md','zip']}}]
});
```

### 入参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| title | String | 是 | 打开弹窗的标题 |
| properties | Array | 是 | 打开的弹窗类型 |
| filters | Array | 是 | 文件过滤配置 |

### 出参

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| canceled | Boolean | 是 | 是否取消选择 |
| filePaths | Array | 是 | 选中的文件路径 |

### 调用示例

```typescript
try {
  const selectResult = await window.Pedestal.remote.dialog.showOpenDialog({
    title: '选择文件',
    properties: ['openFile'],
    filters: [{{ name: '支持的文件', extensions: ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'pdf', 'jpg', 'jpeg', 'png', 'msg', 'md', 'zip'] }}]
});
if (selectResult.canceled) {
  console.log(selectResult.filePaths[0]) // selectResult.filePaths[0]:'"C:\\Users\\SCY\\Desktop\\壁纸\\20200624230952_evwkp.jpg"'
}
} catch (error) {
  //
}
```




