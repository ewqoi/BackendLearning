const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class User extends Model {
  static associate(models) {
    // 可以在这里定义模型关联
  }
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: '姓名不能为空'
      },
      len: {
        args: [2, 50],
        msg: '姓名长度需在2-50个字符之间'
      }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: {
      msg: '该邮箱已被注册'
    },
    validate: {
      isEmail: {
        msg: '请输入有效的邮箱地址'
      }
    }
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: {
        args: [1],
        msg: '年龄必须大于0'
      },
      max: {
        args: [150],
        msg: '年龄必须小于150'
      }
    }
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    onUpdate: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  timestamps: true,
  underscored: false
});

module.exports = User;
