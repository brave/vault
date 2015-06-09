var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');
var eslint = require('gulp-eslint');
var runSequence = require('run-sequence');
var shell = require('gulp-shell');

SRC = ['app.js', 'controllers/**/*.js']

/**
 * Runs travis tests.
 */
var failOnLint = false;
gulp.task('travis-test', function(cb) {
  failOnLint = true;
  runSequence(['lint'], cb);
});

gulp.task('run', function() {
  gulp.src('')
    .pipe(shell('node --harmony index.js'));
});

/**
 * Runs linters on all javascript files found in the src dir.
 */
gulp.task('lint', function() {
  // Note: To have the process exit with an error code (1) on
  // lint error, return the stream and pipe to failOnError last.
  return gulp.src(SRC)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(failOnLint ? eslint.failOnError() : gutil.noop());
});

/**
 * Install pre-commit hook for app.
 */
gulp.task('pre-commit', function() {
  return gulp.src(['./pre-commit'])
    .pipe(gulp.dest('.git/hooks/'));
});

/**
 * Watch for changes on the file system, and rebuild if so.
 */
gulp.task('watch', function() {
  gulp.watch(SRC, ['lint']);
});

/**
 * The default task when `gulp` is run.
 * Adds a listener which will re-build on a file save.
 */
gulp.task('default', function() {
  runSequence('lint', 'watch');
});

/**
 * Cleans all created files by this gulpfile, and node_modules.
 */
gulp.task('clean', function(cb) {
  del([
    'node_modules/'
  ], cb);
});
