function readClipboard() {
  navigator.clipboard.readText()
    .then(function(clipboardText) {
      console.log("剪贴板内容：", clipboardText);
    })
    .catch(function(error) {
      console.error("读取剪贴板时发生错误：", error);
    });
}

readClipboard();