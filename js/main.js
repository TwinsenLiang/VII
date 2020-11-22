(function () {
  var image;
  var contourFinder;
  var startTime = 0;
  var maxResolution = 1024;
  var maxMultiple = 3;

  var resultWidth;
  var resultHeight;

  var imageWidth;

  var filters,
    canny,
    canvas;

  var DIRECTIONS = {
    N: 0,
    NE: 1,
    E: 2,
    SE: 3,
    S: 4,
    SW: 5,
    W: 6,
    NW: 7,
    SAME: 8
  };

  image = document.getElementById('image');
  canvas = document.getElementById('canvas');

  var dropAreaElement = document.querySelector('.main');
  var imageProvider = new ImageProvider({
    element: dropAreaElement,
    onImageRead: function (image) {
      dropAreaElement.classList.add('dropped');
      resultWidth = parseInt(image.width / maxMultiple, 10);
      resultHeight = parseInt(image.height / maxMultiple, 10);
      contourFinder = new ContourFinder();
      canvas = new Canvas('canvas', resultWidth, resultHeight);
      canny = new Canny(canvas);

      image.style.opacity = 0;

      // delete previous images
      var prev = document.querySelector('.container img');
      if (prev) {
        prev.parentNode.removeChild(prev);
      }

      var polylines = document.querySelectorAll('#svg2 polyline');
      if (polylines.length) {
        for (var i = 0; i < polylines.length; i++) {
          polylines[i].parentNode.removeChild(polylines[i]);
        }
      }

      document.querySelector('.container').appendChild(image);

      document.querySelector('.container').appendChild(canvas.elem);
      canvas.loadImg(image.src, 0, 0, resultWidth, resultHeight).then(process);
    }
  });

  imageProvider.init();


  function process() {
    startTime = Date.now();


    canvas.setImgData(ImageFilters.Oil(canvas.getCurrImgData(), 3, 50));
    canvas.setImgData(ImageFilters.Gamma(canvas.getCurrImgData(), 2));
    canvas.setImgData(ImageFilters.Edge(canvas.getCurrImgData()));
    canvas.setImgData(ImageFilters.GrayScale(canvas.getCurrImgData()));
    canvas.setImgData(ImageFilters.Desaturate(canvas.getCurrImgData()));
    canvas.setImgData(ImageFilters.Desaturate(canvas.getCurrImgData()));
    canvas.setImgData(ImageFilters.Solarize(canvas.getCurrImgData()));
    canvas.setImgData(ImageFilters.GaussianBlur(canvas.getCurrImgData(), 1));

    //伽马
    //canvas.setImgData(ImageFilters.Gamma(canvas.getCurrImgData(), 2));
    //边缘
    //canvas.setImgData(ImageFilters.Edge(canvas.getCurrImgData()));
    //油画
    //canvas.setImgData(ImageFilters.Oil(canvas.getCurrImgData(), 2, 50));
    //高斯模糊
    //canvas.setImgData(ImageFilters.GaussianBlur(canvas.getCurrImgData(), 1));
    //灰度
    //canvas.setImgData(ImageFilters.GrayScale(canvas.getCurrImgData()));
    //饱和度
    //canvas.setImgData(ImageFilters.Desaturate(canvas.getCurrImgData()));
    prevData = canvas.getCurrImgData();


    console.log('contourFinder.allContours.length): ' + contourFinder.allContours.length);
    var secs = (Date.now() - startTime) / 1000;
    console.log('Finding contours took ' + secs + 's');
    canvas.setImgData(canny.gradient('sobel'));
    canvas.setImgData(canny.nonMaximumSuppress());
    canvas.setImgData(canny.hysteresis());

    contourFinder.init(canvas.getCanvas());
    contourFinder.findContours();

    drawContours();
    canvas.setImgData(prevData);
  }

  function findOutDirection(point1, point2) {
    if (point2.x > point1.x) {
      if (point2.y > point1.y) {
        return DIRECTIONS.NE;
      } else if (point2.y < point1.y) {
        return DIRECTIONS.SE;
      } else {
        return DIRECTIONS.E;
      }
    } else if (point2.x < point1.x) {
      if (point2.y > point1.y) {
        return DIRECTIONS.NW;
      } else if (point2.y < point1.y) {
        return DIRECTIONS.SW;
      } else {
        return DIRECTIONS.W;
      }
    } else {
      if (point2.y > point1.y) {
        return DIRECTIONS.N;
      } else if (point2.y < point1.y) {
        return DIRECTIONS.S;
      } else {
        return DIRECTIONS.SAME;
      }
    }
  }

  function drawContours() {
    for (var i = 0; i < contourFinder.allContours.length; i++) {
      //console.log('contour #' + i + ' length: ' + contourFinder.allContours[i].length);
      drawContour(i);
    }
    //animate();
    setTimeout(function () {
      document.querySelector('.container img').style.opacity = 0.2;
      document.querySelector('.container svg').style.opacity = 1;
    }, 1000);
  }

  function drawContour(index) {
    var points = contourFinder.allContours[index];

    var optimizedPoints = [],
      direction = null;

    points.reduce(function (accumulator, currentValue, currentIndex, array) {
      //单线条小于10个点
      //console.log('array.length:' + array.length);
      if (array.length < 15) {
        return;
      }
      // 
      if (optimizedPoints.length === 0) {
        optimizedPoints.push(currentValue);
        return null;
      } else {
        var direction = findOutDirection(currentValue, array[currentIndex - 1]);
        if (direction === DIRECTIONS.SAME) {
          return accumulator;
        }
        if (direction !== accumulator) {
          optimizedPoints.push(currentValue);
        } else {
          optimizedPoints[optimizedPoints.length - 1] = currentValue;
        }
        return direction;
      }
    }, null);

    var pointsString = optimizedPoints.map(function (point) {
      return point.x + ',' + point.y;
    }).join(' ');

    var polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttributeNS(null, 'points', pointsString.trim());

    var svg = document.querySelector('#svg2');
    svg.appendChild(polyline);
    svg.setAttribute('viewBox', '0 0 ' + resultWidth + ' ' + resultHeight);
    svg.setAttribute('style', 'width:' + imageWidth + 'px');
  }

  function animate() {
    var polylines = document.querySelectorAll('#svg2 polyline');
    [].forEach.call(polylines, function (polyline, index) {
      var length = contourFinder.allContours[index].length;
      // Clear any previous transition
      polyline.style.transition = polyline.style.WebkitTransition =
        'none';

      // Set up the starting positions
      polyline.style.strokeDasharray = length + ' ' + length;
      polyline.style.strokeDashoffset = length;
      // Trigger a layout so styles are calculated & the browser
      // picks up the starting position before animating
      polyline.getBoundingClientRect();
      // Define our transition
      polyline.style.transition = polyline.style.WebkitTransition =
        'stroke-dashoffset 2s linear';
      // Go!
      polyline.style.strokeDashoffset = '0';
    });

    setTimeout(function () {
      document.querySelector('.container img').style.opacity = 0.4;
      document.querySelector('.container svg').style.opacity = 0;
    }, 2500);
  }
})();
