/*jshint -W108,-W069*/
'use strict';

const pkg = require(__dirname + '/../../package.json');
const fs = require('fs');
const extfs = require('extfs');
const xml2js = require("xml2js");
const parser = new xml2js.Parser();
const Generator = require('yeoman-generator');

const promptTexts = require('./lib/prompttexts.js');
const text = require('./lib/text.js');

const boilerPlatePath = 'AppStoreWidgetBoilerplate/',
      emptyBoilerplatePath = 'WidgetBoilerplate/';

const banner = text.getBanner(pkg);

module.exports = class extends Generator {

  constructor(args, opts) {
    super(args, opts);
  }

  initializing() {
    const done = this.async();
    this.isNew = true;

    this.FINISHED = false;

    this.folders = extfs.getDirsSync(this.destinationRoot());
    this.current = {};
    this.current.version = '1.0.0';
    this.current.name = 'CurrentWidget';

    if (this.folders.indexOf('src') !== -1) {
      const srcFolderContent = extfs.getDirsSync(this.destinationPath('src'));
      if (srcFolderContent.length === 1) {
        this.current.name = srcFolderContent[0];
      }
      if (!extfs.isEmptySync(this.destinationPath('package.json'))) {
        try {
          const destPkg = JSON.parse(fs.readFileSync(this.destinationPath('package.json')).toString());
          this.current.description = destPkg.description;
          this.current.author = destPkg.author;
          this.current.copyright = destPkg.copyright;
          this.current.license = destPkg.license;
          this.current.builder = typeof destPkg.devDependencies.grunt !== "undefined" ? 'grunt' : 'gulp';
        } catch (e) {
          console.error(text.PACKAGE_READ_ERROR + e.toString());
          this.FINISHED = true; done(); return;
        }
      }
      if (!extfs.isEmptySync(this.destinationPath('src/package.xml'))) {
        this.isNew = false;
        const pkgXml = fs.readFileSync(this.destinationPath('src/package.xml')).toString();
        parser.parseString(pkgXml, function (err, result) {
          if (err) {
            this.log('Error: ' + err);
            this.FINISHED = true; done(); return;
          }
          if (result.package.clientModule[0]["$"]["version"]) {
            let version = result.package.clientModule[0]["$"]["version"];
            if (version.split(".").length === 2) {
              version += ".0";
            }
            this.current.version = version;
          }
          done();
        }.bind(this));
      } else {
        this.isNew = false;
        done();
      }
    } else if (!extfs.isEmptySync(this.destinationRoot())) {
      this.log(banner);
      this.log(text.DIR_NOT_EMPTY_ERROR);
      this.FINISHED = true;
      done();
    } else {
      done();
    }
  }

  prompting() {
    const done = this.async();

    if (this.FINISHED) {
      done();
      return;
    }

    // Have Yeoman greet the user.
    this.log(banner);

    if (this.isNew) {
      this
        .prompt(promptTexts.promptsNew())
        .then(function (props) {
          this.props = props;
          done();
        }.bind(this));
    } else {
      this
        .prompt(promptTexts.promptsUpgrade(this.current))
        .then(function (props) {
          this.props = props;
          if (!props.upgrade) {
            process.exit(0);
          } else {
            done();
          }
        }.bind(this));
    }
  }

  writing() {
    if (this.FINISHED) {
      return;
    }

    console.log(this.props);
    // Define widget variables
    this.widget = {};
    this.widget.widgetName = this.props.widgetName;
    this.widget.packageName = this.props.widgetName;
    this.widget.description = this.props.description || this.current.description;
    this.widget.version = this.props.version;
    this.widget.author = this.props.author || this.current.author;
    this.widget.date = (new Date()).toLocaleDateString();
    this.widget.copyright = this.props.copyright || this.current.copyright;
    this.widget.license = this.props.license || this.current.license;
    this.widget.generatorVersion = pkg.version;

    this.widget.builder = this.props.builder;

    if (this.isNew) {
      const source = this.props.boilerplate === 'appstore' ? boilerPlatePath : emptyBoilerplatePath;
      this.props.widgetOptionsObj = {};
      if (this.props.boilerplate === 'empty') {
        for (let i = 0; i < this.props.widgetoptions.length; i++) {
          this.props.widgetOptionsObj[this.props.widgetoptions[i]] = true;
        }
      }

      // Copy generic files
      this.fs.copy(this.templatePath('icon.png'), this.destinationPath('icon.png'));
      this.fs.copy(this.templatePath(boilerPlatePath + 'assets/app_store_banner.png'), this.destinationPath('assets/app_store_banner.png'));
      this.fs.copy(this.templatePath(boilerPlatePath + 'assets/app_store_icon.png'), this.destinationPath('assets/app_store_icon.png'));
      //this.fs.copy(this.templatePath(source + 'LICENSE'), this.destinationPath('LICENSE'));
      this.fs.copy(this.templatePath(source + 'README.md'), this.destinationPath('README.md'));
      this.fs.copy(this.templatePath(boilerPlatePath + 'test/Test.mpr'), this.destinationPath('test/Test.mpr'));
      this.fs.copy(this.templatePath(boilerPlatePath + 'xsd/widget.xsd'), this.destinationPath('xsd/widget.xsd'));

      // Copy files based on WidgetName

      if (this.props.boilerplate === 'appstore' || this.props.widgetOptionsObj.jquery) {
        this.fs.copy(
          this.templatePath(boilerPlatePath + 'src/WidgetName/lib/jquery-1.11.2.js'),
          this.destinationPath('src/' + this.widget.widgetName + '/lib/jquery-1.11.2.js')
        );
      }

      if (this.props.boilerplate === 'appstore' || this.props.widgetOptionsObj.templates) {
        this.fs.copy(
          this.templatePath(source + 'src/WidgetName/widget/template/WidgetName.html'),
          this.destinationPath('src/' + this.widget.widgetName + '/widget/template/' + this.widget.widgetName + '.html')
        );
      }

      this.fs.copy(
        this.templatePath(source + 'src/WidgetName/widget/ui/WidgetName.css'),
        this.destinationPath('src/' + this.widget.widgetName + '/widget/ui/' + this.widget.widgetName + '.css')
      );

      // Rename references in widget main JS
      if (this.props.boilerplate === 'appstore') {
        this.fs.copy(
          this.templatePath(source + 'src/WidgetName/widget/WidgetName.js'),
          this.destinationPath('src/' + this.widget.widgetName + '/widget/' + this.widget.widgetName + '.js'),
          {
            process: function (file) {
              let fileText = file.toString();
              fileText = fileText
                            .replace(/WidgetName\.widget\.WidgetName/g, this.widget.packageName + '.widget.' + this.widget.widgetName)
                            .replace(/WidgetName\/widget\/WidgetName/g, this.widget.packageName + '/widget/' + this.widget.widgetName)
                            .replace(/WidgetName/g, this.widget.widgetName)
                            .replace(/\{\{version\}\}/g, this.widget.version)
                            .replace(/\{\{date\}\}/g, this.widget.date)
                            .replace(/\{\{copyright\}\}/g, this.widget.copyright)
                            .replace(/\{\{license\}\}/g, this.widget.license)
                            .replace(/\{\{author\}\}/g, this.widget.author);
              return fileText;
            }.bind(this)
          }
        );
      } else {
        this.widget.options = this.props.widgetOptionsObj;
        this.fs.copyTpl(
          this.templatePath(source + 'src/WidgetName/widget/WidgetName.js.ejs'),
          this.destinationPath('src/' + this.widget.widgetName + '/widget/' + this.widget.widgetName + '.js'),
          this.widget
        );
      }

      // Rename references package.xml
      this.fs.copy(
        this.templatePath(boilerPlatePath + 'src/package.xml'),
        this.destinationPath('src/package.xml'),
        {
          process: function (file) {
            let fileText = file.toString();
            fileText = fileText
                          .replace(/WidgetName/g, this.widget.widgetName)
                          .replace(/\{\{version\}\}/g, this.widget.version);
            return fileText;
          }.bind(this)
        }
      );

      // Rename references WidgetName
      this.fs.copy(
        this.templatePath(source + 'src/WidgetName/WidgetName.xml'),
        this.destinationPath('src/' + this.widget.widgetName + '/' + this.widget.widgetName + '.xml'),
        {
          process: function (file) {
            let fileText = file.toString();
            fileText = fileText
                          .replace(/WidgetName\.widget\.WidgetName/g, this.widget.packageName + '.widget.' + this.widget.widgetName)
                          .replace(/WidgetName/g, this.widget.widgetName);
            return fileText;
          }.bind(this)
        }
      );
    }

    // Gitignore
    this.fs.copy(this.templatePath('_gitignore'), this.destinationPath('.gitignore'));

    // jshint
    this.fs.copy(this.templatePath('_jshintrc'), this.destinationPath('.jshintrc'));

    // Package.JSON
    try { extfs.removeSync(this.destinationPath('package.json')); } catch (e) {}

    console.log()
    this.fs.copyTpl(
      this.templatePath('_package.json'),
      this.destinationPath('package.json'),
      this.widget, {}
    );

    // Add Gulp/Grunt
    this.pkg = pkg;

    try { extfs.removeSync(this.destinationPath('Gruntfile.js')); } catch (e) {}
    try { extfs.removeSync(this.destinationPath('Gulpfile.js')); } catch (e) {}

    if (this.widget.builder === 'gulp') {
      this.fs.copyTpl(
        this.templatePath('Gulpfile.js'),
        this.destinationPath('Gulpfile.js'),
        this, {}
      );
    } else {
      this.fs.copyTpl(
        this.templatePath('Gruntfile.js'),
        this.destinationPath('Gruntfile.js'),
        this,
        {}
      );
    }

    this.fs.copy(
      this.templatePath('editorconfig'),
      this.destinationPath('.editorconfig')
    );
  }

  install() {
    if (this.FINISHED) {
      return;
    }
    this.log(text.INSTALL_FINISH_MSG);
    this.npmInstall();
  }

  end() {
    if (this.FINISHED) {
      return;
    }
    if (extfs.isEmptySync(this.destinationPath("node_modules"))) {
      this.log(text.END_NPM_NEED_INSTALL_MSG);
    } else {
      this.log(text.END_RUN_BUILD_MSG);
      this.spawnCommand('npm', ['run', 'build']);
    }
  }
};
