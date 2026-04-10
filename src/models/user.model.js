const UserRole = Object.freeze({
  ADMIN: "admin",
  CLIENTE: "cliente",
});

class UserModel {
  constructor({
    id = null,
    email = "",
    username = "",
    role = UserRole.CLIENTE,
    name = "",
    phone = "",
    address = "",
  } = {}) {
    this.id = id;
    this.email = email;
    this.username = username;
    this.role =
      role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.CLIENTE;
    this.name = name;
    this.phone = phone;
    this.address = address;
  }

  copyWith({
    id,
    email,
    username,
    role,
    name,
    phone,
    address,
  } = {}) {
    return new UserModel({
      id: id ?? this.id,
      email: email ?? this.email,
      username: username ?? this.username,
      role: role ?? this.role,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      address: address ?? this.address,
    });
  }

  toJson() {
    return {
      id: this.id,
      email: this.email,
      username: this.username,
      role: this.role,
      name: this.name,
      phone: this.phone,
      address: this.address,
    };
  }

  static fromJson(json = {}) {
    return new UserModel({
      id: json.id ?? null,
      email: json.email ?? "",
      username: json.username ?? "",
      role: json.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.CLIENTE,
      name: json.name ?? "",
      phone: json.phone ?? "",
      address: json.address ?? "",
    });
  }

  static fromSessionJson(json = {}) {
    return new UserModel({
      id: json.id ?? null,
      email: json.email ?? "",
      username: json.username ?? "",
      role: json.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.CLIENTE,
      name: json.name ?? "",
      phone: json.phone ?? "",
      address: json.address ?? "",
    });
  }
}

export { UserModel, UserRole };
export default UserModel;