const login = async (loginOrPhone: string, password: string) => {
  const payload: any = {
    login: loginOrPhone,
    phone: loginOrPhone,
    password,
  };
  const response = await api.post('/login', payload);
  const { token, user } = response.data;
  localStorage.setItem('token', token);
  setUser(user);
  await fetchUser();
};