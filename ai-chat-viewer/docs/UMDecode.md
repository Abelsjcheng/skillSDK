# 文件UM解码

## 1. 设计目的

已知CUI内用户发送的文件和agent回复的文件渲染到聊天记录中本质上都是UM编码，CUI需要根据UM编码进行相应解码从而渲染成对应的文件卡片；

## 2. 整体格式

/:um_begin{um_url|file_type|file_size|file_name|duration|width;height;access_code|扩展属性}/:um_end
- 外层包裹标记：/:um_begin{...}/:um_end
- 内部字段以 | 分隔
- 一条消息的content中可包含多个UM片段（如图文混排多图）

## 3.各字段定义

| 索引 | 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- |
| um[0] | um_url | string | 是 | 文件下载地址 |
| um[1] | file_type | string | 是 | 文件类型枚举:"File","Img","Video" |
| um[2] | file_size | string | 是 | 文件大小,单位字节 |
| um[3] | file_name | string | 是 | 文件名，路径分隔符/和\需替换为# |
| um[4] | duration | number | 是 | 时长（秒），仅音视频有效，文件/图片为0 |
| um[5] | extras | string | 是 | 附加信息，子字段以;分隔 |
| um[6] | ext_props | string | 否 | 扩展属性，key:value 对，以;分隔 |
| um[7] | solid_type | string | 否 | 仅视频消息，固定值"solidType:0" |
| um[8] | video_preview | string | 否 | 仅视频消息，首帧截图信息，子字段以;分隔 |

## 4.um[5] extras子字段

width;height;um_plain_access_code

| 子索引 | 字段 | 类型 | 说明 |
| --- | --- | --- |
| extra[0] | width | string | 图片/视频宽度，File类型为空字符串 |
| extra[1] | height | string | 图片/视频高度，File类型为空字符串 |
| extra[2] | um_plain_access_code | string | 文件访问码（可能含多个;，取最后一个） |

不同消息类型的 extras 差异：
| 类型 | extras示例 |
| --- | --- | --- |
| File | ;;access_code（宽高为空） |
| Img | 1920;1080;access_code（宽高为空） |
| Video | 1920;1080;access_code（宽高为空） |

## 5.um[6] ext_props扩展属性

格式：key1:value1;key2:value2;...

| key | 类型 | 说明 |
| --- | --- | --- |
| isOriginalImg | number | 是否原图，0=否，1=是 |
| md5 | string | 文件MD5值 |
| cdnUrl | string | CDN下载地址 |
| expire | number | 是否过期，1=过期 |

不同消息类型的 ext_props 差异：
| 类型 | 包含的属性 |
| --- | --- | --- |
| File/Img | isOriginalImg,md5,cdnUrl,expire(可选) |
| Video | isOriginalImg,md5,expire(可选) |

## 6.um[8] video_preview 视频首帧

格式：preview_url;width;height;access_code

| 子字段 | 类型 | 说明 |
| --- | --- | --- |
| preview_url | string | 首帧截图下载URL，必须以https://开头 |
| width | string | 截图宽度 |
| height | string | 截图高度 |
| access_code | string | 截图访问码 |

## 7.各消息类型的UM编码示例

1、文件消息（FILE）
/:um_begin{https://um.test.com/file123|File|1024000|report.docx|0|;;access_code|isOriginalImg:0;md5:abc123;cdnUrl:}/:um_end

2、图片消息（IMAGE/IMAGE_TEXT）
/:um_begin{https://um.test.com/img456|Img|1034000|abc123.png|0|1920;1080;access_code|isOriginalImg:0;md5:abd123;cdnUrl:}/:um_end

3、视频消息（VIDEO）
/:um_begin{https://um.test.com/vid789|Video|1034001|video123.mp4|15|1920;1080;access_code|isOriginalImg:0;md5:abf123;|solidType:0|https://um.test.com/preview.png;960;540;preview_code}/:um_end

## 8.各消息类型的卡片渲染

1、文件消息（FILE/VIDEO）
/:um_begin{https://um.test.com/file123|File|1024000|report.docx|0|;;access_code|isOriginalImg:0;md5:abc123;cdnUrl:}/:um_end
渲染为一个文件卡片，卡片高度固定280px，从左到右是：
1.1、48x48 px的文件缩略图，距离卡片左边距8px，垂直居中，根据文件名后缀判断文件类型，展示对应的文件缩略图（ai-chat-viewer\src\imgs\doc.png;ai-chat-viewer\src\imgs\excel.png;ai-chat-viewer\src\imgs\txt.png;ai-chat-viewer\src\imgs\video.png），当前只支持这四种文件缩略图匹配，其余类型一律显示为ai-chat-viewer\src\imgs\unknowFile.png；1.2、文件缩略图右侧是文件信息和下载按钮区域（距离文件缩略图8px）：上方先展示文件名（距离卡片顶部边距9px），文件名字体大小14px，字重400，行高22px，文件名区域宽度最大194px，高度最大40px，超过文件名显示区域后打点省略显示文件名（支持文件名换行显示），文件名下方4px显示文件大小和下载按钮：文件大小字体12px，字重400，行高20px，下载按钮（ai-chat-viewer\src\imgs\downloadFile.png）和文件大小同一水平线展示，宽高固定16x16px；
1.3、右键点击文件卡片时，在鼠标点击处弹出一个卡片气泡菜单，该卡片宽度固定128px，高度自适应，当前卡片菜单含有三个选项：打开文件；打开文件夹；下载；从上往下依次排列，每个选项字体16px，字重400，行高22px，上下左右边距12px，文本左对齐展示

2、图片消息（IMAGE/IMAGE_TEXT）
/:um_begin{https://um.test.com/img456|Img|1034000|abc123.png|0|1920;1080;access_code|isOriginalImg:0;md5:abd123;cdnUrl:}/:um_end
2.1、图片通过UM编码获取服务端地址和访问码将图片下载到本地然后通过img标签直接加载本地图片
2.2、图片右键点击，在鼠标点击处弹出一个卡片气泡菜单，该卡片宽度固定128px，高度自适应，当前卡片菜单含有二个选项：查看；下载；从上往下依次排列，每个选项字体16px，字重400，行高22px，上下左右边距12px，文本左对齐展示













