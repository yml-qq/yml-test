const compileUtil = {
	getVal(expr, vm) {
		return expr.split(".").reduce((data, currentVal) => {
			// console.log('data', data);
			// console.log('currentVal', currentVal);
			// console.log('value', data[currentVal]);
			return data[currentVal];
		}, vm.$data);
		// return expr.split(".").forEach((item)=> {
		//  console.log(item);
		//  console.log(vm.$data[item]);
		//  // return vm.$data[item]
		// })
	},
	getnewVal(expr, vm) {
		value = expr.replace(/\{\{(.+?)\}\}/g, (...args) => { // 用replace方法，正则取出 person.name 然后调用 getVal 方法
			return this.getVal(args[1], vm);
		})
	},
	text(node, expr, vm) { //这样直接 vm.$data[expr] 取值是不行的，因为有 person.name 这样的值没法[]直接取值
		let value;
		if (expr.indexOf("{{") !== -1) { // 判断是否是{{person.name}}这样的
			value = expr.replace(/\{\{(.+?)\}\}/g, (...args) => { // 用replace方法，正则取出 person.name 然后调用 getVal 方法；
				new Watcher(vm, args[1], (newVal)=> {
					this.updater.textUpdate(node, this.getnewVal(expr, vm));
				});
				return this.getVal(args[1], vm);
			})
		} else {
			new Watcher(vm, expr, (newVal)=> {
				this.updater.textUpdate(node, newVal);
			});
			value = this.getVal(expr, vm);
		}
		this.updater.textUpdate(node, value); // 将节点中text指令，进行data中数据的赋值
	},
	html(node, expr, vm) {
		let value = this.getVal(expr, vm);
		// 绑定更新函数，数据驱动更新视图
		new Watcher(vm, expr, (newVal)=> {
			this.updater.htmlUpdate(node, newVal);
		});
		
		this.updater.htmlUpdate(node, value);
	},
	model(node, expr, vm) {
		let value = this.getVal(expr, vm);
		new Watcher(vm, expr, (newVal)=> {
			this.updater.modelUpdate(node, newVal);
		});
		this.updater.modelUpdate(node, value);
	},
	on(node, expr, vm, eventName) {
		let fn = vm.$options.methods && vm.$options.methods[expr]; // 取到methods里面的方法
		node.addEventListener(eventName, fn.bind(vm), false);
	},
	bind(node, expr, vm, attrName) {
		node.setAttribute(attrName, vm.$data[expr]);
	},
	updater: {
		textUpdate(node, value) {
			node.textContent = value;
		},
		htmlUpdate(node, value) {
			node.innerHTML = value;
		},
		modelUpdate(node, value) {
			node.value = value;
		}
	}
};
// 指令解析器
class Compile {
	constructor(el, vm) {
		// 判断$el是否是元素节点,如果是则赋值给this.el;如果不是则获取元素节点,赋值给this.el
		this.el = this.isNodeElement(el) ? el : document.querySelector(el);
		this.vm = vm;
		// 因为所谓的指令解析器就是需要拿到根节点下所有的子节点,然后把拿出来的节点进行数据的替换。这样会导致页面元素的回流与重绘，非常影响页面性能。
		// 解决方法：
		// 1、使用文档碎片。获取文档碎片对象，放入内存中，会减少页面的回流与重绘
		let fragment = this.nodeFragments(this.el);
		// console.log(fragment);
		// 2、编译compile,将数据编译进去
		this.compile(fragment);
		// 3、将文档碎片追加放到页面上
		this.el.appendChild(fragment);
	}

	// 判断是否为元素节点的方法
	isNodeElement(node) {
		return node.nodeType === 1;
	}

	// 将根节点中所有的子节点放入文档碎片中
	nodeFragments(el) {
		const f = document.createDocumentFragment(); // 创建文档碎片
		let firstChild;
		while (firstChild = el.firstChild) { // el.firstChild获取el节点的第一个子节点，将它赋值给firstChild。循环一直取el.firstChild，直到取完时，el.firstChild为undefined，循环停止
			f.appendChild(firstChild); //将循环取出的el.firstChild追加进文档碎片对象
		}
		return f;
	}

	// compile编译器
	compile(fragment) {
		const childNodes = fragment.childNodes;
		[...childNodes].forEach(child => { // childNodes取出来的是类数组(伪数组),用[...childNodes]进行强制类型转换。也可以用Array.from()方法
			if (this.isNodeElement(child)) {
				// console.log('元素节点',child);
				this.compileElement(child);
			} else {
				// console.log('文本节点',child)
				this.compileText(child);
			}
			if (child.childNodes && child.childNodes.length) {
				this.compile(child);
			}
		})
	}

	compileElement(node) {
		const attributes = node.attributes; // 使用attributes获取所有元素节点的所有属性的集合
		// console.log(attributes);     //这里的数据类型要注意
		// console.log([...attributes]);
		[...attributes].forEach(attr => { //强制类型转换，转换为数组；循环遍历出子元素中所有的属性
			// console.log(attr);
			const {
				name,
				value
			} = attr; //解构赋值解析出属性及属性值
			// console.log(name)
			// 判断是自定义指令还是元素的原本属性
			if (this.isDirective(name)) {
				// console.log(name);
				const [, directive] = name.split("-"); // 将v-text等字符串，从 “ - ” 进行分割，进行解构赋值，前面的不要，只要-后面的。所以directive为 text、html、model、on:click 等
				// console.log(directive);
				const [dirName, eventName] = directive.split(":"); // text、html、model、bind、on、click
				// console.log(dirName);
				// 数据驱动视图，更新数据
				compileUtil[dirName](node, value, this.vm, eventName);
				node.removeAttribute('v-' + directive); // 删除元素节点中 v-attr 的属性
			} else if (this.eventAiTeName(name)) { // 判断是否自定义指令是否是 @ 的事件指令
				const [, eventName] = name.split("@");
				compileUtil['on'](node, value, this.vm, eventName);
			} else if (this.attrMHName(name)) {
				const [, eventName] = name.split(":");
				compileUtil['bind'](node, value, this.vm, eventName);
			}
		})
	}

	compileText(node) {
		const content = node.nodeValue;
		if (/\{\{(.+?)\}\}/.test(content)) {
			compileUtil['text'](node, content, this.vm);
		}
	}

	// 检测属性名是否是指令
	isDirective(attrName) {
		return attrName.startsWith("v-");
	}
	// 检测属性名是否是@开头的事件指令
	eventAiTeName(attrName) {
		return attrName.startsWith("@");
	}
	// 检测属性名是否是 : 开头的v-bind简写
	attrMHName(attrName) {
		return attrName.startsWith(":");
	}
}

// 观察者
class Watcher {
	constructor(vm, expr, cb) {
		this.vm = vm;
		this.expr = expr;
		this.cb = cb;
		this.oldValue = this.getOldValue();		// 获取保存旧值
	}
	// 获取旧值的方法
	getOldValue() {
		Dep.target = this;
		const oldVal = compileUtil.getVal(this.expr, this.vm);
		Dep.target = null;
		return oldVal;
	}
	// 观察者通知watcher后,更新视图。就是执行watcher中updater方法
	updater() {
		const newVal = compileUtil.getVal(this.expr, this.vm);		// 获取新的值，判断是否有变化，如果有则返回出去
		// console.log("新值", newVal);
		if(newVal !== this.oldVal) {		
			this.cb(newVal);
		}
	}
}

// 实现dep，两个作用：1、添加观察者；2、通知观察者更新视图。具体看笔记的图。当数据发生变化时，调用dep，所以在数据劫持的get监听方法中调用dep添加观察者
class Dep {
	constructor() {
		this.subs = [];
	}
	// 添加观察者
	addSubs(watcher) {
		this.subs.push(watcher);
		// console.log(this.subs);
	}
	// 通知观察者
	notice(watcher){
		// console.log('观察者',this.subs);
		this.subs.forEach(w => w.updater());
	}
}

// 数据观察者
class Observer {
	constructor(data) {
		this.observe(data);
	}
	// 拿出data对象中所有的属性及属性值
	observe(data) {
		if(data && typeof data === "object") {
			// console.log(Object.keys(data));
			Object.keys(data).forEach(key => {
				this.defineReactive(key, data, data[key]);
			})
		}
	}
	// observe 方法只拿出了一层,如果有深层的对象时调用defineReactive递归处理
	defineReactive(key, data, value) {
		this.observe(value);
		const dep = new Dep();
		// 对象data属性的数据劫持,并对属性进行监听。Object.defineProperty 了解见：https://www.cnblogs.com/ldq678/p/13854113.html
		Object.defineProperty(data, key, {
			configurable: true,
			enumerable: true,
			get() {
				Dep.target && dep.addSubs(Dep.target);
				return value;
			},
			set: (newValue)=> {		// 当在对对象重新赋值后，因为是重新赋值的对象，所以是没有get和set的监听方法的。解决：在set方法内重新调用observe函数（有this指向问题，所以用箭头函数）
				this.observe(newValue);
				if(value !== newValue) {
					value = newValue;
				}
				// 改变值,则执行dep通知watcher变化
				dep.notice();
			}
		})
	}
}
// 创建MVue类
class Mvue {
	// 定义属性
	constructor(options) {
		this.$el = options.el;
		this.$data = options.data;
		this.$options = options;
		// 判断是否有el，如果有才在el中操作
		if (this.$el) {
			// 要实现的目标：1、实现一个数据观察者。2、指令解析器
			new Observer(this.$data);
			new Compile(this.$el, this);
			this.proxyData(this.$data);
		}
	}

	proxyData(data) {
		for(let key in data) {
			Object.defineProperty(this, key, {
				get() {
					return data[key];
				},
				set(newVal) {
					data[key] = newVal;
				}
			})
		}
	}
}
