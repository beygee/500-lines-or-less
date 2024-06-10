// 기본 설정
import express from 'express'
const app = express()
const PORT = 3000

// 정적 파일 불러오기
app.use(express.static(__dirname + '/public'))

// 라우팅 정의
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

// 서버 실행
app.listen(PORT, () => {
  console.log(`Listen : ${PORT}`)
})
