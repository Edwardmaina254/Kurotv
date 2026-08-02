const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('https://graphql.anilist.co', {
      query: 'query($id: Int){Media(id: $id){title{romaji english}}}',
      variables: { id: 178789 }
    });
    console.log(res.data);
  } catch(e) {
    console.error(e.response ? e.response.status : e.message);
  }
}
test();
